import { calculatePlatformFee, calculateClientCancelFee, milestoneFee } from './settlement-fee.util';

/**
 * 순수 함수 테스트 - DB나 외부 의존성이 전혀 없어서 가장 빠르고 안정적으로
 * 검증할 수 있는 대상이다. Math.floor로 내림 처리하는 부분(소수점 발생 케이스)을
 * 특히 신경써서 검증한다 - 정산 금액은 "버림"이 명확하게 지켜져야 의뢰인/전문가
 * 양쪽 다 부정확한 금액을 안내받지 않는다.
 */
describe('settlement-fee.util', () => {
  describe('calculatePlatformFee', () => {
    it('구간 시작 수수료 + 1만 원마다 추가금', () => {
      expect(calculatePlatformFee(100000)).toBe(15000);
      expect(calculatePlatformFee(120000)).toBe(18000);
      expect(calculatePlatformFee(200000)).toBe(30000);
      expect(calculatePlatformFee(250000)).toBe(36000);
      expect(calculatePlatformFee(300000)).toBe(42000);
      expect(calculatePlatformFee(500000)).toBe(62000);
      expect(calculatePlatformFee(1000000)).toBe(102000);
      expect(calculatePlatformFee(2000000)).toBe(162000);
      expect(calculatePlatformFee(5000000)).toBe(342000);
      expect(calculatePlatformFee(6000000)).toBe(392000);
    });

    it('앞 구간 끝 금액이 다음 구간 시작 수수료와 같다 (경계에서 뛰지 않음)', () => {
      expect(calculatePlatformFee(190000) + 1500).toBe(calculatePlatformFee(200000));
      expect(calculatePlatformFee(290000) + 1200).toBe(calculatePlatformFee(300000));
      expect(calculatePlatformFee(490000) + 1000).toBe(calculatePlatformFee(500000));
      expect(calculatePlatformFee(990000) + 800).toBe(calculatePlatformFee(1000000));
      expect(calculatePlatformFee(4990000) + 600).toBe(calculatePlatformFee(5000000));
    });

    it('1만 원 미만 끝자리는 세지 않는다', () => {
      expect(calculatePlatformFee(105000)).toBe(15000);
      expect(calculatePlatformFee(109999)).toBe(15000);
    });

    it('0원 프로젝트는 수수료도 0원이다', () => {
      expect(calculatePlatformFee(0)).toBe(0);
    });

    it('최소 거래 10만 원~2천만 원 모든 금액에서 크몽(19.7%)보다 싸고, 결제 비용을 빼도 플랫폼에 돈이 남는다', () => {
      for (let amount = 100000; amount <= 20000000; amount += amount < 1000000 ? 100 : 10000) {
        const fee = calculatePlatformFee(amount);
        expect(fee / amount).toBeLessThanOrEqual(0.15);
        expect(fee - amount * 0.0396 - 1000 - 50).toBeGreaterThan(0);
      }
    });

    it('경계에서 갑자기 뛰지 않는다 (1만 원 올라갈 때 늘어나는 수수료는 최대 1,500원)', () => {
      for (let amount = 100000; amount < 3000000; amount += 10000) {
        expect(calculatePlatformFee(amount + 10000) - calculatePlatformFee(amount)).toBeLessThanOrEqual(1500);
      }
    });
  });

  describe('milestoneFee', () => {
    it('전체 수수료를 금액 비율로 나누고 마지막 정산이 남은 몫을 가져간다', () => {
      const total = calculatePlatformFee(300000); // 45000
      const first = milestoneFee(total, 300000, 100000, 0, 0);
      expect(first).toBe(Math.floor((total * 100000) / 300000));
      const last = milestoneFee(total, 300000, 200000, 100000, first);
      expect(first + last).toBe(total);
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
