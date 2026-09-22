/**
 * 결제대행사(PG) 연동을 위한 공통 인터페이스.
 *
 * StorageService(storage/storage.interface.ts)와 완전히 같은 원칙: 이 인터페이스에만
 * 의존하게 만들어두면, Mock 구현체 <-> 실제 포트원 구현체를 mocks.module.ts의
 * provider 설정 하나만 바꿔서 교체할 수 있다. 나머지 코드(TransactionsService,
 * BountiesService)는 어떤 구현체가 실제로 쓰이는지 전혀 몰라도 된다.
 *
 * verifyPayment: 클라이언트가 결제창(프론트엔드의 포트원 SDK 체크아웃)에서 결제를
 *   "완료했다고 주장"할 때, 그 주장을 그대로 믿지 않고 서버가 PG사에 직접 물어봐서
 *   진짜로 결제가 됐는지/금액이 맞는지 확인하는 단계. 결제 위변조를 막는 핵심 로직이다.
 * cancelPayment: 환불(의뢰인 단순변심, 전문가 귀책 등) 발생 시 실제로 PG에 취소를 요청.
 */
export abstract class PaymentGatewayService {
  abstract verifyPayment(
    paymentId: string,
    expectedAmount: number,
  ): Promise<{ paid: boolean; reason?: string }>;

  abstract cancelPayment(
    paymentId: string,
    amount: number,
    reason: string,
  ): Promise<{ cancelled: boolean; reason?: string }>;
}
