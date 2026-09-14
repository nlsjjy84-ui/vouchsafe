import { IsOptional, IsString } from 'class-validator';

export class ApplyBountyDto {
  @IsOptional()
  @IsString()
  message?: string;
}
