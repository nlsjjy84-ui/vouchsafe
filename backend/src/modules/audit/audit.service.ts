import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  /** 관리자 조치 하나를 감사 로그에 기록한다. 실패해도 원래 하려던 작업(예: 이의제기 중재)을 막으면 안 되므로, 호출하는 쪽에서 이 메서드의 실패를 신경 쓰지 않아도 되게 설계했다 (에러를 삼키지 않고 던지긴 하지만, 로그 기록 자체는 트랜잭션과 분리되어 있다). */
  async record(params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    detail: string;
  }): Promise<void> {
    const log = this.auditLogRepository.create(params);
    await this.auditLogRepository.save(log);
  }

  /** 관리자 화면에서 감사 로그 전체를 최신순으로 확인할 때 사용 */
  findAll(): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  /** 특정 대상(예: 하나의 dispute)에 대한 조치 이력만 조회 */
  findByTarget(targetType: string, targetId: string): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
    });
  }
}
