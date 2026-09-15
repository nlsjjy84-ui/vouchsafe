import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { PUBLIC_REGISTERABLE_ROLES, UserRole } from '../../../common/enums/user-role.enum';
import { IsStrongPassword } from '../../../common/validators/strong-password.decorator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  // @IsEnum(UserRole)이 아니라 화이트리스트(@IsIn)를 쓰는 이유:
  // UserRole에 ADMIN이 추가된 뒤에도 회원가입 API로는 ADMIN을 절대 선택할 수 없게 하기 위함.
  @IsIn(PUBLIC_REGISTERABLE_ROLES, {
    message: `role은 ${PUBLIC_REGISTERABLE_ROLES.join(', ')} 중 하나여야 합니다`,
  })
  role: UserRole;
}
