import PortOne from '@portone/browser-sdk/v2';

/**
 * 실제 포트원(PortOne) 결제창을 띄우는 얇은 래퍼.
 *
 * paymentId는 반드시 백엔드가 미리 발급한 값을 그대로 써야 한다
 * (BountiesService.selectApplicant → TransactionsService.initiatePayment에서 생성).
 * 그래야 결제가 끝난 뒤 백엔드가 "이 결제가 어느 프로젝트 것인지"를 같은 ID로
 * 다시 조회(PaymentGatewayService.verifyPayment)해서 위변조 없이 검증할 수 있다.
 *
 * NEXT_PUBLIC_PORTONE_STORE_ID / NEXT_PUBLIC_PORTONE_CHANNEL_KEY는 "공개용" 값이라
 * 프론트엔드 코드에 그대로 들어가도 안전하다 (백엔드 전용인 API Secret과는 다름).
 */
export async function payForBounty(params: {
  paymentId: string;
  amount: number;
  orderName: string;
}): Promise<{ success: true } | { success: false; message: string }> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

  /**
   * 포트원 "채널"(admin.portone.io > 결제 연동 > 채널 관리)이 아직 등록되지 않은
   * 개발/데모 환경 - 채널이 없으면 결제창 자체를 못 띄운다(portone-payment-gateway.service.ts
   * 주석 참고). 여기서 그냥 에러로 막아버리면 결제 확인 게이트 전체를 시연할 방법이
   * 없어지므로, 백엔드의 PAYMENT_GATEWAY_DRIVER=mock과 같은 원칙으로 [MOCK] 라벨을 달고
   * 결제창 없이 바로 성공 처리한다. 실제 채널 키를 .env.local에 채우면 이 분기를 안 타고
   * 진짜 결제창이 뜬다.
   */
  if (!storeId || !channelKey) {
    console.warn(
      '[MOCK] 포트원 결제 채널이 설정되지 않아 결제창 없이 결제 성공으로 처리합니다. ' +
        '실제 결제창을 보려면 frontend/.env.local에 NEXT_PUBLIC_PORTONE_STORE_ID / ' +
        'NEXT_PUBLIC_PORTONE_CHANNEL_KEY를 채워주세요.',
    );
    return { success: true };
  }

  const response = await PortOne.requestPayment({
    storeId,
    channelKey,
    paymentId: params.paymentId,
    orderName: params.orderName,
    totalAmount: params.amount,
    currency: 'KRW',
    payMethod: 'CARD',
  });

  // response.code가 있으면 실패(사용자 취소 포함) - 없으면 성공적으로 결제창을 통과한 것.
  // 그래도 "진짜 결제됐는지"는 서버가 confirm-payment에서 PG에 재확인해야 안전하다.
  if (!response || response.code) {
    return { success: false, message: response?.message ?? '결제가 취소되었거나 실패했습니다.' };
  }
  return { success: true };
}
