import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Client, types } from 'pg';

/**
 * DB 옮기기: 지금 DB(SRC_URL)의 모든 데이터를 새 DB(DST_URL)로 그대로 복사한다.
 *  1) 새 DB에 앱을 한 번 띄워 테이블을 만든다 (synchronize — 지금 코드의 엔티티와 똑같은 구조)
 *  2) 외래키 순서대로 테이블마다 모든 행을 복사한다 (값은 문자열 그대로 옮겨 시간대·숫자가 바뀌지 않게)
 *  3) 테이블마다 행 수를 양쪽에서 세어 같은지 확인한다
 * 새 DB에 이미 데이터가 있으면 아무것도 하지 않고 멈춘다(덮어쓰기 사고 방지). 원래 DB는 읽기만 한다.
 * 사용법: SRC_URL, DST_URL 을 지정하고 실행 (move-vouchsafe-db.bat 이 대신 해 준다)
 */

// 날짜·시간·JSON은 문자열 그대로 읽고 그대로 쓴다 (변환하다 시간대가 밀리거나 JSON이 배열로 바뀌는 것 방지)
for (const oid of [1082, 1114, 1184, 114, 3802]) types.setTypeParser(oid, (v: string) => v);

const SRC = process.env.SRC_URL ?? '';
const DST = process.env.DST_URL ?? '';

const client = (url: string) => new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function tables(c: Client): Promise<string[]> {
  const r = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
  return r.rows.map((x) => x.table_name as string);
}

/** 외래키가 가리키는 테이블이 먼저 오도록 정렬 */
async function ordered(c: Client, names: string[]): Promise<string[]> {
  const r = await c.query(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
  );
  const deps = new Map<string, Set<string>>(names.map((n) => [n, new Set<string>()]));
  for (const row of r.rows) if (row.child !== row.parent && deps.has(row.child)) deps.get(row.child)!.add(row.parent);
  const out: string[] = [];
  const done = new Set<string>();
  const visit = (n: string, path: Set<string>) => {
    if (done.has(n) || path.has(n)) return;
    path.add(n);
    for (const p of deps.get(n) ?? []) visit(p, path);
    done.add(n);
    out.push(n);
  };
  for (const n of names) visit(n, new Set());
  return out;
}

async function main() {
  if (!/^postgres(ql)?:\/\//.test(SRC) || !/^postgres(ql)?:\/\//.test(DST)) throw new Error('SRC_URL / DST_URL 이 postgres:// 주소가 아닙니다');
  if (SRC === DST) throw new Error('두 주소가 같습니다');
  console.log('원래 DB:', new URL(SRC).hostname);
  console.log('새 DB  :', new URL(DST).hostname);

  // 1) 새 DB에 테이블 만들기 — 지금 코드의 AppModule을 새 DB 주소로 한 번 띄웠다 닫는다
  process.env.DATABASE_URL = DST;
  const { AppModule } = await import('../app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  await app.close();
  console.log('[1/3] 새 DB에 테이블을 만들었습니다');

  const src = client(SRC);
  const dst = client(DST);
  await src.connect();
  await dst.connect();
  try {
    const srcTables = await tables(src);
    const dstTables = new Set(await tables(dst));
    const missing = srcTables.filter((t) => !dstTables.has(t));
    if (missing.length) throw new Error(`새 DB에 없는 테이블: ${missing.join(', ')}`);
    for (const t of srcTables) {
      const n = Number((await dst.query(`SELECT count(*)::int AS n FROM ${q(t)}`)).rows[0].n);
      if (n > 0) throw new Error(`새 DB의 ${t} 테이블에 이미 데이터가 ${n}행 있습니다. 덮어쓰지 않으려고 멈춥니다.`);
    }

    // 2) 복사 (한 트랜잭션 — 중간에 실패하면 새 DB는 빈 채로 남는다)
    const order = await ordered(src, srcTables);
    await dst.query('BEGIN');
    for (const t of order) {
      const cols = (await dst.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [t],
      )).rows.map((x) => x.column_name as string);
      const srcCols = new Set((await src.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [t],
      )).rows.map((x) => x.column_name as string));
      const use = cols.filter((c) => srcCols.has(c));
      const rows = (await src.query(`SELECT ${use.map(q).join(', ')} FROM ${q(t)}`)).rows;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const params: unknown[] = [];
        const values = chunk.map((row) => `(${use.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(', ')})`);
        await dst.query(`INSERT INTO ${q(t)} (${use.map(q).join(', ')}) VALUES ${values.join(', ')}`, params);
      }
      console.log(`  ${t}: ${rows.length}행`);
    }
    await dst.query('COMMIT');
    console.log('[2/3] 데이터를 복사했습니다');

    // 3) 행 수 비교
    let same = true;
    for (const t of srcTables) {
      const a = Number((await src.query(`SELECT count(*)::int AS n FROM ${q(t)}`)).rows[0].n);
      const b = Number((await dst.query(`SELECT count(*)::int AS n FROM ${q(t)}`)).rows[0].n);
      if (a !== b) { same = false; console.log(`  다름! ${t}: 원래 ${a} / 새 ${b}`); }
    }
    if (!same) throw new Error('행 수가 다른 테이블이 있습니다');
    console.log(`[3/3] 테이블 ${srcTables.length}개 행 수가 모두 같습니다`);
    console.log('COPY OK');
  } catch (e) {
    await dst.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((err) => {
  console.error('DB 옮기기 실패:', err instanceof Error ? err.message : err);
  process.exit(1);
});
