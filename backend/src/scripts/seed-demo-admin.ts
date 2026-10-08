import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * 로컬 시연 전용 관리자 계정 1개를 만든다 (seed-demo와 같은 성격의 데모 계정).
 * ADMIN은 공개 회원가입으로 만들 수 없으므로 서버 콘솔에서만 실행한다.
 * 운영 환경에서는 절대 쓰지 말고, 운영 관리자는 `npm run create-admin`으로 직접 만든다.
 *
 * 사용법: npm run seed-demo-admin
 * 계정: demo-admin@demo.com / AdminDemo123!@#
 */
const ADMIN_EMAIL = 'demo-admin@demo.com';
const ADMIN_PASSWORD = 'AdminDemo123!@#';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    console.error('운영 환경에서는 데모 관리자를 만들 수 없습니다.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const usersService = app.get(UsersService);
    if (await usersService.findByEmail(ADMIN_EMAIL)) {
      console.log(`이미 있습니다: ${ADMIN_EMAIL}`);
      return;
    }
    const admin = await usersService.create({
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      name: '데모 관리자',
      role: UserRole.ADMIN,
      ciHash: crypto.randomBytes(32).toString('hex'),
      emailVerifiedAt: new Date(),
    });
    console.log(`데모 관리자 생성 완료: ${admin.email}`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('데모 관리자 생성 실패:', err);
  process.exit(1);
});
