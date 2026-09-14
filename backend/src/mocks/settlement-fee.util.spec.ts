import { calculatePlatformFee, calculateClientCancelFee } from './settlement-fee.util';

/**
 * 순수 함수 테스트 - DB나 외부 의존성이 전혀 없어서 가장 빠르고 안정적으로
 * 검증할 수 있는 대상이다. Math.floor로 내림 처리하는 부분(소수점 발생 케이스)을
 * 특히 신경써서 검증한다 - 정산 금액은 "버림"이 명확하게 지켜져야 의뢰인/전문가
 * 양쪽 다 부정확한 금액을 안내받지 않는다.
 */
describe('settlement-fee.util', () => {
  describe('calculatePlatformFee', () => {
    it('바운티 금액의 10%를 내림 처리해서 반환한다', () => {
      expect(calculatePlatformFee(100000)).toBe(10000);
      expect(calculatePlatformFee(1000000)).toBe(100000);
    });

    it('나눗셈 결과가 소수점이 생기는 금액도 내림 처리한다', () => {
      // 100005 * 0.1 = 10000.5 -> 내림하면 10000
      expect(calculatePlatformFee(100005)).toBe(10000);
    });

    it('0원 바운티는 수수료도 0원이다', () => {
      expect(calculatePlatformFee(0)).toBe(0);
    });
  });

  describe('calculateClientCancelFee', () => {
    it('원금의 3%를 내림 처리해서 반환한다', () => {
      expect(calculateClientCancelFee(100000)).toBe(3000);
      expect(calculateClientCancelFee(1000000)).toBe(30000);
    });

    it('나눗셈 결과가 소수점이 생기는 금액도 내림 처리한다', () => {
      // 100001 * 0.03 = 3000.03 -> 내림하면 3000
      expect(calculateClientCancelFee(100001)).toBe(3000);
    });

    it('0원 환불은 취소 수수료도 0원이다', () => {
      expect(calculateClientCancelFee(0)).toBe(0);
    });
  });
});
