import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OrderOfferDto {
  /** 의뢰인이 덧붙이는 한 줄(차종·장소·원하는 날짜 등). 연락처는 넣지 않는다. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
