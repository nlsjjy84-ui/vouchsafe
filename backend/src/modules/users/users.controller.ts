import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * 지금은 "내 전화번호 등록/수정" 하나뿐이다. 마이페이지(Task #31) 통합
 * 대시보드는 이 컨트롤러가 아니라 별도의 `DashboardModule`
 * (`GET /api/dashboard/me`)로 만들었다 - BountiesModule이 이미
 * UsersModule을 가져다 쓰고 있어서, 만약 그 조립 로직을 여기 UsersController에
 * 두고 UsersModule이 거꾸로 BountiesModule을 가져오면 순환 참조가 생기기
 * 때문이다 (dashboard.service.ts 상단 설명 참고).
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 안심번호(가상번호) 발급 등 연락처가 필요한 기능을 쓰기 전에 먼저 등록해야 하는
   * 내 실제 전화번호. 상대방에게는 절대 이 값 그대로 노출되지 않는다.
   * PATCH /api/users/me/phone
   */
  @Patch('me/phone')
  async updatePhone(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdatePhoneDto,
  ) {
    await this.usersService.updatePhoneNumber(user.userId, dto.phoneNumber);
    return { updated: true };
  }
}
