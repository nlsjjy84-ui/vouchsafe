import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

export interface PortOnePaymentStatus {
  paid: boolean;
  amount: number;
  paymentId: string;
  raw: unknown;
}

/**
 * PortOne(구 아임포트) V2 결제 연동.
 *
 * PortOne 결제는 "클라이언트가 먼저 결제를 시도(1단계) → 서버가 결과를 조회해서 진짜
 * 결제된 게 맞는지 재확인(2단계)"하는 2단계 구조다. 클라이언트가 보낸 "결제 성공했어요"라는
 * 말만 믿으면 위변조된 요청으로 결제 없이 프로젝트를 진행시킬 수 있어서, 반드시 서버가
 * PortOne API를 직접 호출해서 금액과 상태를 재검증해야 한다 — 이 서비스가 그 2단계를 맡는다.
 *
 * 샌드박스/운영 전환은 PORTONE_API_SECRET 값만 바꾸면 된다 (PortOne이 시크릿 자체로 환경을 구분).
 * 지금 단계에서는 실제 PortOne 계정이 없어 이 메서드가 실제로 호출되지는 않지만,
 * 인터페이스와 호출 방식은 PortOne V2 REST API 스펙을 그대로 따르므로 계정만 생기면 바로 동작한다.
 */
@Injectable()
export class PortOneService {
  private readonly logger = new Logger(PortOneService.name);
  private readonly apiBase = 'https://api.portone.io';

  private get apiSecret(): string {
    return process.env.PORTONE_API_SECRET ?? '';
  }

  /** 2단계: paymentId로 PortOne에 직접 조회해서 실제 결제 상태/금액을 확인한다 */
  async verifyPayment(paymentId: string): Promise<PortOnePaymentStatus> {
    if (!this.apiSecret) {
      throw new InternalServerErrorException('PORTONE_API_SECRET이 설정되지 않았습니다');
    }

    let response: Response;
    try {
      response = await fetch(`${this.apiBase}/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `PortOne ${this.apiSecret}` },
      });
    } catch (err) {
      this.logger.error(`PortOne 결제 조회 실패(네트워크): ${(err as Error).message}`);
      throw new BadRequestException('결제 정보를 조회하지 못했습니다');
    }

    if (!response.ok) {
      this.logger.warn(`PortOne 결제 조회 실패: HTTP ${response.status}`);
      throw new BadRequestException('결제 정보를 조회하지 못했습니다');
    }

    const data = (await response.json()) as {
      status?: string;
      amount?: { total?: number };
    };

    return {
      paid: data.status === 'PAID',
      amount: data.amount?.total ?? 0,
      paymentId,
      raw: data,
    };
  }
}
