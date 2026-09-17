import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

/** bounties 테이블의 실제 컬럼명을 확인하기 위한 1회성 진단 스크립트. */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const dataSource = app.get(DataSource);
    const rows = await dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'bounties' ORDER BY ordinal_position`,
    );
    console.log('=== bounties 테이블 컬럼 목록 ===');
    for (const r of rows) console.log(r.column_name);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('컬럼 조회 실패:', err);
  process.exit(1);
});
