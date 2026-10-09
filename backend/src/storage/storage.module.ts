import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MocksModule } from '../mocks/mocks.module';
import { MockStorageService } from '../mocks/mock-storage.service';
import { S3StorageService } from './s3-storage.service';
import { DbStorageService } from './db-storage.service';
import { StoredFile } from './stored-file.entity';
import { STORAGE_SERVICE } from './storage.interface';

/**
 * STORAGE_DRIVER 환경변수(mock | s3 | db)로 실제 주입될 구현체를 고른다.
 * 값이 없으면: DATABASE_URL 이 있는 배포 환경은 db(재시작해도 파일 유지), 로컬은 mock(디스크).
 * 이 팩토리 하나가 전환의 전부다 — 컨트롤러는 코드를 건드릴 필요가 없다.
 */
export function pickStorageDriver(): 'mock' | 's3' | 'db' {
  const v = process.env.STORAGE_DRIVER;
  if (v === 's3' || v === 'db' || v === 'mock') return v;
  return process.env.DATABASE_URL ? 'db' : 'mock';
}

@Module({
  imports: [MocksModule, TypeOrmModule.forFeature([StoredFile])],
  providers: [
    S3StorageService,
    DbStorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (mock: MockStorageService, s3: S3StorageService, db: DbStorageService) => {
        const driver = pickStorageDriver();
        return driver === 's3' ? s3 : driver === 'db' ? db : mock;
      },
      inject: [MockStorageService, S3StorageService, DbStorageService],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
