import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PUBLIC_REGISTRABLE_ROLES, UserRole } from '../../../common/enums/user-role.enum';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../../../common/validators/password-policy';

export class RegisterDto {
  @IsEmail()
  email: string;

  // [보안 강화] 8자 이상 → 16자 이상 + 대/소문자 + 특수문자 조합 필수로 강화.
  // 길이와 문자 구성 조건을 한 번에 검사하는 정규식이라 @MinLength는 따로 안 쓴다
  // (password-policy.ts의 정규식 안에 길이 조건 .{16,}이 이미 포함되어 있다).
  @IsString()
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  // @IsEnum(UserRole)이 아니라 @IsIn(PUBLIC_REGISTRABLE_ROLES)를 쓴 이유:
  // UserRole에는 ADMIN도 포함되어 있는데, 공개 회원가입 API로 누구나
  // role: "ADMIN"을 보내서 관리자가 될 수 있으면 보안 구멍이 된다.
  // PUBLIC_REGISTRABLE_ROLES = [CLIENT, EXPERT, HYBRID] 로 화이트리스트를 좁혀서
  // ADMIN 값이 오면 이 시점에서 400 검증 에러로 막는다.
  @IsIn(PUBLIC_REGISTRABLE_ROLES)
  role: UserRole;

  // 선택 입력 - 안심번호(가상번호) 발급 등 연락처가 필요한 기능을 쓸 때만 필요.
  // 가입 시 입력 안 해도 나중에 PATCH /users/me/phone으로 등록 가능.
  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]-?\d{3,4}-?\d{4}$/, { message: '휴대폰 번호 형식이 올바르지 않습니다 (예: 010-1234-5678)' })
  phoneNumber?: string;
}
