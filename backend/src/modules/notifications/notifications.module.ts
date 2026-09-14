import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * 다른 도메인 모듈(Bounties/Disputes/Certifications)에 의존하지 않는 "말단" 모듈이라
 * 순환 참조 걱정 없이 어디서든 가져다 쓸 수 있다 - AuditModule과 같은 위치의 모듈.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
