import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExpertsService } from './experts.service';

/** 전문가 공개 프로필 - 로그인 없이 볼 수 있다(투명성). */
@ApiTags('experts')
@Controller('experts')
export class ExpertsController {
  constructor(private readonly service: ExpertsService) {}

  @Get(':id/profile')
  profile(@Param('id') id: string) {
    return this.service.getProfile(id);
  }
}
