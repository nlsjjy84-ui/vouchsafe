import { IsBoolean, IsString, MinLength } from 'class-validator';

export class ReviewCertificationDto {
  @IsBoolean()
  approved: boolean;

  @IsString()
  @MinLength(2)
  note: string;
}
