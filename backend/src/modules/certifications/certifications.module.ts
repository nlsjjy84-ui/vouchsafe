import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certification } from './entities/certification.entity';
import { CertificationsService } from './certifications.service';
import { CertificationsController } from './certifications.controller';
import { MocksModule } from '../../mocks/mocks.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Certification]), MocksModule, AuditModule, NotificationsModule],
  providers: [CertificationsService],
  controllers: [CertificationsController],
  exports: [CertificationsService],
})
export class CertificationsModule {}
