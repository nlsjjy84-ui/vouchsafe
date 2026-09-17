import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../common/enums/user-role.enum';

const SALT_ROUNDS = 10;
// Security 5탄과 동일한 정책(10자 이상 + 대/소문자 + 숫자 + 특수문자) — 관리자 계정이라고 예외를 두지 않는다.
const PASSWORD_MIN_LENGTH = 10;
const STRONG_PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]).+$/;

/**
 * 관리자 계정 생성 전용 서버 콘솔 스크립트.
 * 공개 회원가입 API(RegisterDto)는 @IsIn(PUBLIC_REGISTERABLE_ROLES)로 ADMIN 선택을
 * 원천 차단하고 있어서, ADMIN 계정을 만드는 유일한 경로는 서버에 직접 접근해
 * 이 스크립트를 실행하는 것뿐이다 — "회원가입 경로로는 관리자 권한을 만들 수 없다"는
 * 원칙을 지키기 위한 의도적인 설계.
 *
 * 사용법: npm run create-admin -- <email> <password> [name]
 */
async function bootstrap() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error('사용법: npm run create-admin -- <email> <password> [name]');
    process.exit(1);
  }
  if (password.length < PASSWORD_MIN_LENGTH || !STRONG_PASSWORD_REGEX.test(password)) {
    console.error(
      `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이며 대문자/소문자/숫자/특수문자를 각각 1개 이상 포함해야 합니다`,
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const usersService = app.get(UsersService);

    const existing = await usersService.findByEmail(email);
    if (existing) {
      console.error(`이미 존재하는 이메일입니다: ${email}`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    // 관리자는 실제 본인인증 대상이 아니므로, CI 해시는 재현 불가능한 랜덤값으로 채운다
    // (unique 제약을 만족시키기 위한 자리표시자일 뿐, 일반 유저의 ciHash와는 성격이 다르다).
    const ciHash = crypto.randomBytes(32).toString('hex');

    const admin = await usersService.create({
      email,
      passwordHash,
      name: name ?? '관리자',
      role: UserRole.ADMIN,
      ciHash,
      emailVerifiedAt: new Date(), // 관리자는 콘솔에서 직접 만드는 것이므로 이메일 인증 절차를 생략
    });

    console.log(`관리자 계정 생성 완료: ${admin.email} (id: ${admin.id})`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('관리자 계정 생성 실패:', err);
  process.exit(1);
});
