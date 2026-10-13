import { MockEscrowService } from './mock-escrow.service';

/**
 * 유닛 테스트 — MockEscrowService의 수수료 계산 (기획서 9장 정산 규칙표)
 * 플랫폼 기본 수수료 10%, 의뢰인 단순변심 취소 수수료 3% — 소수점은 항상 내림(Math.floor)한다.
 */
describe('MockEscrowService 수수료 계산', () => {
  const service = new MockEscrowService();

  it('플랫폼 수수료는 누진식이다 (10만 원 → 15,000)', () => {
    expect(service.calculatePlatformFee(100000)).toBe(15000);
  });

  it('1만 원 미만 끝자리는 세지 않는다 (123457원 → 12단위 → 18,000)', () => {
    expect(service.calculatePlatformFee(123457)).toBe(18000);
  });

  it('의뢰인 단순변심 취소 수수료는 금액의 3%다', () => {
    expect(service.calculateClientCancelFee(100000)).toBe(3000);
  });

  it('취소 수수료도 소수점을 내림 처리한다 (10001원의 3% = 300.03 → 300)', () => {
    expect(service.calculateClientCancelFee(10001)).toBe(300);
  });
});
