import { IsString, Length, Matches } from 'class-validator';

/** 정산 계좌 등록 — 은행 코드(3자리), 계좌번호(숫자·하이픈), 예금주 */
export class RegisterPayoutDto {
  @IsString()
  @Matches(/^\d{3}$/, { message: '은행을 골라 주세요' })
  bankCode: string;

  @IsString()
  @Matches(/^[\d-\s]{10,20}$/, { message: '계좌번호는 숫자 10~14자리로 적어 주세요' })
  accountNumber: string;

  @IsString()
  @Length(1, 40, { message: '예금주 이름을 적어 주세요' })
  holderName: string;
}
