import { IsString, Matches } from 'class-validator';

export class UpdatePhoneDto {
  // 010-1234-5678 처럼 하이픈이 있어도 없어도 통과시키고, 저장은 입력값 그대로 둔다
  // (마스킹/포맷 통일은 Phase 2 - 지금은 "연락처가 등록되어 있는지" 여부가 중요).
  @IsString()
  @Matches(/^01[0-9]-?\d{3,4}-?\d{4}$/, { message: '휴대폰 번호 형식이 올바르지 않습니다 (예: 010-1234-5678)' })
  phoneNumber: string;
}
