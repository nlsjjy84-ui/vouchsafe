import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/strong-password.decorator';

export class ConfirmPasswordResetDto {
  @IsString()
  token: string;

  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
