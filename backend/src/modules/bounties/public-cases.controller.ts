import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BountiesService } from './bounties.service';

/**
 * =========================================================================
 * PublicCasesController — "공개 거래 사례" 전용 컨트롤러 (로그인 불필요)
 * =========================================================================
 * BountiesController와 굳이 분리한 이유: BountiesController는 클래스 레벨에
 * @UseGuards(JwtAuthGuard)가 걸려 있어서 로그인해야만 통과된다. 그런데
 * 공개 사례는 "처음 들어온 사람도(=가입 전 방문자도) 사례를 보고 믿고
 * 거래를 결정할 수 있어야 한다"는 요청이라, 애초에 인증 가드 자체가 없는
 * 별도 컨트롤러로 빼는 게 기존 가드 로직을 건드리지 않는 가장 안전한 방법이다.
 *
 * GET /api/cases 는 정산 완료(SETTLED)된 거래를 전부 익명화해서 내려준다 -
 * 실제 로직/집계는 BountiesService.listPublicCases() 참고.
 * =========================================================================
 */
@ApiTags('cases')
@Controller('cases')
export class PublicCasesController {
  constructor(private readonly bountiesService: BountiesService) {}

  /** GET /api/cases — 공개 거래 사례 목록 (최신 정산순) */
  @Get()
  listPublicCases() {
    return this.bountiesService.listPublicCases();
  }
}
