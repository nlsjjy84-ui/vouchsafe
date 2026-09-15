import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SafeNumberMapping } from './entities/safe-number-mapping.entity';
import { SafeNumberService } from './safe-number.service';
import { MocksModule } from '../../mocks/mocks.module';

@Module({
  imports: [TypeOrmModule.forFeature([SafeNumberMapping]), MocksModule],
  providers: [SafeNumberService],
  exports: [SafeNumberService],
})
export class SafeNumberModule {}
