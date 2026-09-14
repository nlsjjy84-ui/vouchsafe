import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * =========================================================================
 * AuditController — 관리자 감사 로그 조회 (관리자 전용)
 * =========================================================================
 * 이 컨트롤러의 모든 API는 ADMIN 역할만 호출할 수 있다. 감사 로그는 "누가
 * 무슨 조치를 했는지"를 담고 있어서, 일반 사용자에게 노출되면 오히려 프라이버시
 * 문제가 될 수 있다 (예: 다른 사람의 분쟁 처리 내역).
 * =========================================================================
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** 전체 감사 로그 최신순 조회 (최대 200건). GET /api/admin/audit-logs */
  @Get()
  findAll() {
    return this.auditService.findAll();
  }

  /** 특정 대상(예: 하나의 이의제기 건)에 대한 조치 이력만 조회. GET /api/admin/audit-logs/dispute/:id */
  @Get(':targetType/:targetId')
  findByTarget(@Param('targetType') targetType: string, @Param('targetId') targetId: string) {
    return this.auditService.findByTarget(targetType, targetId);
  }
}
