import { Module } from '@nestjs/common';
import { MocksModule } from '../mocks/mocks.module';
import { MockStorageService } from '../mocks/mock-storage.service';
import { S3StorageService } from './s3-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

/**
 * STORAGE_DRIVER 환경변수(mock | s3, 기본값 mock)로 실제 주입될 구현체를 고른다.
 * 이 팩토리 하나가 "Mock/S3 전환"의 전부다 — 호출하는 쪽(컨트롤러)은 코드를 전혀
 * 건드릴 필요 없이 .env의 STORAGE_DRIVER 값만 바꾸면 된다.
 */
@Module({
  imports: [MocksModule],
  providers: [
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (mock: MockStorageService, s3: S3StorageService) =>
        process.env.STORAGE_DRIVER === 's3' ? s3 : mock,
      inject: [MockStorageService, S3StorageService],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
