import { IsString, Matches } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../../../common/validators/password-policy';

export class ResetPasswordDto {
  @IsString()
  token: string;

  // [보안 강화] register.dto.ts와 동일한 정책(16자 이상 + 대/소문자 + 특수문자)을
  // 그대로 재사용한다 - password-policy.ts 참고.
  @IsString()
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword: string;
}
