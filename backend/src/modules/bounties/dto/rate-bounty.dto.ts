import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

/** 1.0 ~ 10.0, 0.5 단위로만 허용되는 값 목록 (프론트 입력 스펙과 동일하게 서버에서도 검증) */
const ALLOWED_RATINGS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);

export class RateBountyDto {
  @IsNumber()
  @IsIn(ALLOWED_RATINGS, { message: 'rating은 1.0~10.0 사이 0.5 단위 값이어야 합니다' })
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
