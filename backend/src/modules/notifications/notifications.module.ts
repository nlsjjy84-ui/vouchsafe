import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { AlertPreference } from './entities/alert-preference.entity';
import { AlertsService } from './alerts.service';
import { Certification } from '../certifications/entities/certification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, AlertPreference, Certification])],
  providers: [NotificationsService, AlertsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, AlertsService],
})
export class NotificationsModule {}
