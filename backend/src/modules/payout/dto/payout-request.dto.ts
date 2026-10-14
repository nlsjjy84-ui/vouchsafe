import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePayoutRequestDto {
  /** 비우면 출금 가능 금액 전부 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;
}

export class RejectPayoutRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason: string;
}
