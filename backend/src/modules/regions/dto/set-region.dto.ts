import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SetRegionDto {
  @IsString()
  @MinLength(1, { message: '시/도를 선택해 주세요' })
  @MaxLength(20)
  sido: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sigungu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dong?: string;
}
