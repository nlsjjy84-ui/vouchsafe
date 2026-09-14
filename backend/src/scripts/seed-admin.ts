/**
 * =========================================================================
 * seed-admin.ts — 최초 관리자(ADMIN) 계정을 만드는 "1회성" 스크립트
 * =========================================================================
 * 왜 API가 아니라 스크립트로 만드나?
 *   ADMIN 계정은 회원가입 API(POST /auth/register)로는 절대 만들 수 없게
 *   막아뒀다(register.dto.ts 참고). 관리자 계정은 "서버에 직접 접근할 수 있는
 *   사람"만 만들 수 있어야 안전하기 때문에, 서버 콘솔/터미널에서만 실행 가능한
 *   이 스크립트로 분리했다. → 웹으로는 절대 뚫리지 않는 통로.
 *
 * 실행 방법 (backend 폴더에서):
 *   ADMIN_EMAIL=admin@credobounty.com ADMIN_PASSWORD=원하는비밀번호 ADMIN_NAME=관리자 \
 *     npx ts-node -T src/scripts/seed-admin.ts
 *
 * 이미 같은 이메일의 계정이 있으면 새로 만들지 않고, 그 계정의 role만 ADMIN으로
 * 승격시킨다 (이미 회원가입한 본인 계정을 관리자로 바꾸고 싶을 때도 쓸 수 있음).
 * =========================================================================
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Certification } from '../modules/certifications/entities/certification.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../common/validators/password-policy';

dotenv.config();

const SALT_ROUNDS = 10;

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? '관리자';

  if (!email || !password) {
    console.error(
      '[seed-admin] ADMIN_EMAIL, ADMIN_PASSWORD 환경변수가 필요합니다.\n' +
        '예) ADMIN_EMAIL=admin@credobounty.com ADMIN_PASSWORD=비밀번호 npx ts-node -T src/scripts/seed-admin.ts',
    );
    process.exit(1);
  }
  // [보안 강화] 일반 회원가입/비밀번호 재설정과 동일한 정책(password-policy.ts)을
  // 관리자 계정에도 그대로 적용한다 - 오히려 가장 강한 권한을 가진 계정이니까
  // 일반 계정보다 약한 비밀번호를 허용할 이유가 없다.
  if (!PASSWORD_POLICY_REGEX.test(password)) {
    console.error(`[seed-admin] ${PASSWORD_POLICY_MESSAGE}`);
    process.exit(1);
  }

  // Nest 앱을 통째로 부팅하지 않고, TypeORM DataSource만 직접 열어서
  // 이 스크립트가 필요한 최소한의 일(유저 테이블 읽고 쓰기)만 한다.
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'credobounty',
    entities: [User, Certification],
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const existing = await userRepo.findOne({ where: { email } });

  if (existing) {
    existing.role = UserRole.ADMIN;
    existing.passwordHash = passwordHash;
    // [보안 강화 - 회귀 수정] Task #41(이메일 인증 전 로그인 차단)을 추가한 뒤
    // 실제로 테스트해보니, emailVerifiedAt이 없는 계정은 관리자로 승격해도
    // 로그인 자체가 막혀서 이 스크립트로 만든 계정이 무용지물이 되는 버그가
    // 있었다. 관리자 계정은 서버 콘솔에 직접 접근할 수 있는 사람만 만들 수
    // 있는 별도 통로(파일 상단 설명 참고)라 이미 이메일 인증 절차가 검증하려는
    // "본인이 그 이메일 주인이다"보다 더 강한 신뢰 경로로 만들어진 것으로 보고,
    // 여기서 자동으로 인증 완료 처리한다.
    existing.emailVerifiedAt = existing.emailVerifiedAt ?? new Date();
    await userRepo.save(existing);
    console.log(`[seed-admin] 기존 계정(${email})을 ADMIN으로 승격하고 비밀번호를 갱신했습니다.`);
  } else {
    // 일반 회원가입과 마찬가지로 ciHash(unique)가 필요하므로 Mock 방식으로 하나 생성한다.
    const ciHash = createHash('sha256').update(`${email.toLowerCase()}::${randomUUID()}`).digest('hex');
    const admin = userRepo.create({
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
      ciHash,
      emailVerifiedAt: new Date(), // 위 설명과 동일한 이유로 자동 인증 처리
    });
    await userRepo.save(admin);
    console.log(`[seed-admin] 새 관리자 계정을 생성했습니다: ${email}`);
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('[seed-admin] 실패:', err);
  process.exit(1);
});
