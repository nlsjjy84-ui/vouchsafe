import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/** 배포/개발 환경에서 서버가 살아있는지 빠르게 확인하는 용도. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  check() {
    return { status: 'ok', service: 'vouchsafe-api', time: new Date().toISOString() };
  }

  /**
   * 시연 직전 점검용: 서버가 깨어 있을 뿐 아니라 DB 연결까지 살아 있는지 확인한다.
   * (무료 호스팅은 서버가 잠들었다 깨어날 때 DB 연결이 늦게 붙는 경우가 있다.)
   */
  @Get('ready')
  async ready() {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'db-unavailable', service: 'vouchsafe-api' });
    }
    return { status: 'ok', db: 'ok', dbMs: Date.now() - started, time: new Date().toISOString() };
  }
}
