import { Injectable, BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.interface';
import { validateFileSignature } from '../storage/magic-byte-validator';

/**
 * 기획서 7장 "S3 Pre-signed URL 발급 전 백엔드에서 확장자 필터링과 용량 제한을 강제"의 Mock 구현.
 * 실제로는 S3 Pre-signed URL을 발급해 클라이언트가 직접 업로드하지만,
 * 로컬 개발 단계에서는 백엔드가 직접 디스크에 저장하고 같은 검증 로직만 재사용한다.
 *
 * 보안 강화 2탄: 용량 상한은 이제 호출자가 넘겨주는 maxSizeBytes(용도별)를 쓰고,
 * 확장자 화이트리스트 검사는 매직바이트 대조(validateFileSignature)로 대체됐다 —
 * 확장자만 보고 안전하다고 믿지 않는다.
 *
 * StorageService 인터페이스를 구현 — StorageModule이 STORAGE_DRIVER 환경변수에 따라
 * 이 클래스와 S3StorageService 중 하나를 골라 STORAGE_SERVICE 토큰으로 주입한다.
 */
@Injectable()
export class MockStorageService implements StorageService {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor() {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): string {
    if (buffer.length > maxSizeBytes) {
      throw new BadRequestException(
        `파일 용량이 ${Math.floor(maxSizeBytes / (1024 * 1024))}MB를 초과했습니다`,
      );
    }
    validateFileSignature(originalName, buffer);

    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
    const storedName = `${randomUUID()}${ext}`;
    writeFileSync(join(this.uploadDir, storedName), buffer);
    // 실제로는 S3 URL, 지금은 로컬 정적 경로
    return `/uploads/${storedName}`;
  }
}
