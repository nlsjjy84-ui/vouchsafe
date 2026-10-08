import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RegionsService } from './regions.service';
import { SetRegionDto } from './dto/set-region.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainType } from '../../common/enums/domain-type.enum';

const WRITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/**
 * 지역별 전문가·프로젝트 찾기. 읽기는 공개, 지역 설정은 로그인 필요.
 * 공개되는 것은 사용자가 직접 설정한 '활동 지역(동 단위)'과 프로젝트 '만남 지역'뿐이다.
 */
@ApiTags('regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly service: RegionsService) {}

  @Get('facets')
  facets(@Query('type') type?: string) {
    return this.service.facets(type === 'bounty' ? 'bounty' : 'expert');
  }

  @Get('experts')
  experts(@Query('sido') sido?: string, @Query('sigungu') sigungu?: string, @Query('dong') dong?: string, @Query('domain') domain?: string) {
    return this.service.listExperts({ sido, sigungu, dong, domain: this.domain(domain) });
  }

  @Get('bounties')
  bounties(@Query('sido') sido?: string, @Query('sigungu') sigungu?: string, @Query('dong') dong?: string, @Query('domain') domain?: string) {
    return this.service.listBounties({ sido, sigungu, dong, domain: this.domain(domain) });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { userId: string }) {
    return this.service.getMyRegion(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Put('me')
  setMe(@CurrentUser() user: { userId: string }, @Body() dto: SetRegionDto) {
    return this.service.setMyRegion(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  clearMe(@CurrentUser() user: { userId: string }) {
    return this.service.clearMyRegion(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Put('bounties/:id')
  setBounty(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: SetRegionDto) {
    return this.service.setBountyRegion(user.userId, id, dto);
  }

  private domain(v?: string): DomainType | undefined {
    return v && (Object.values(DomainType) as string[]).includes(v) ? (v as DomainType) : undefined;
  }
}
