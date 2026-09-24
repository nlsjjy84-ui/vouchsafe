import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/** 배포/개발 환경에서 서버가 살아있는지 빠르게 확인하는 용도. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'vouchsafe-api', time: new Date().toISOString() };
  }
}
