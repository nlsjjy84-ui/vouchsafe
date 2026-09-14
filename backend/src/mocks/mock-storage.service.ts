import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { StorageService } from './storage.interface';
import { validateUploadedFile } from './file-validation.util';

/**
 * 기획서 7장 "S3 Pre-signed URL 발급 전 백엔드에서 확장자 필터링과 용량 제한을 강제"의 Mock 구현.
 * 실제로는 S3 Pre-signed URL을 발급해 클라이언트가 직접 업로드하지만,
 * 로컬 개발 단계에서는 백엔드가 직접 디스크에 저장하고 같은 검증 로직만 재사용한다.
 *
 * StorageService를 implements 했다는 것은 "S3StorageService와 완전히 같은 방식으로
 * 갈아 끼울 수 있다"는 뜻이다. 실제 전환 방법은 storage.module.ts와
 * PROGRESS.md의 "AWS S3 연동 전환 방법" 항목 참고.
 */
@Injectable()
export class MockStorageService implements StorageService {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor() {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // 인터페이스와 시그니처를 맞추기 위해 async로 선언했지만, 로컬 디스크 쓰기는
  // 원래 동기 함수(writeFileSync)라 실제로는 기다릴 비동기 작업이 없다.
  async saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): Promise<string> {
    const ext = validateUploadedFile(originalName, buffer, maxSizeBytes);
    const storedName = `${randomUUID()}${ext}`;
    writeFileSync(join(this.uploadDir, storedName), buffer);
    // 실제로는 S3 URL, 지금은 로컬 정적 경로 (main.ts의 useStaticAssets로 서빙됨)
    return `/uploads/${storedName}`;
  }
}
