import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { StorageService } from './storage.interface';
import { validateFileSignature } from './magic-byte-validator';
import { StoredFile } from './stored-file.entity';
import { contentTypeForExt } from './content-types';

/**
 * StorageService의 DB 보관 구현체 (STORAGE_DRIVER=db).
 * 검증 규칙(용도별 용량 상한 + 매직바이트 대조)은 Mock/S3와 완전히 같고,
 * 저장 위치만 서버 디스크 대신 Postgres(stored_files 테이블)다.
 * 반환 값은 기존과 같은 `/uploads/<이름>` 경로라서 프론트·DB의 기존 데이터 형식을 바꿀 필요가 없다.
 * (서빙은 storage/uploads-route.ts 가 담당)
 *
 * 한계: 대용량·대량 트래픽에는 맞지 않는다 — 실서비스에서는 S3 같은 오브젝트 스토리지로 전환
 * (STORAGE_DRIVER=s3). 인터페이스가 같아서 환경변수 한 줄이면 바뀐다.
 */
@Injectable()
export class DbStorageService implements StorageService {
  constructor(
    @InjectRepository(StoredFile) private readonly repo: Repository<StoredFile>,
  ) {}

  async saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): Promise<string> {
    if (buffer.length > maxSizeBytes) {
      throw new BadRequestException(
        `파일 용량이 ${Math.floor(maxSizeBytes / (1024 * 1024))}MB를 초과했습니다`,
      );
    }
    validateFileSignature(originalName, buffer);

    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
    const id = randomUUID();
    await this.repo.save(
      this.repo.create({
        id,
        originalName: originalName.slice(0, 255),
        contentType: contentTypeForExt(ext),
        size: buffer.length,
        data: buffer,
      }),
    );
    return `/uploads/${id}${ext}`;
  }
}
