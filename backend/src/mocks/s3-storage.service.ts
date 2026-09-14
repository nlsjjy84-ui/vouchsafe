import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { StorageService } from './storage.interface';
import { validateUploadedFile } from './file-validation.util';

/**
 * =========================================================================
 * S3StorageService — MockStorageService의 "실제 서비스용" 짝
 * =========================================================================
 * MockStorageService와 완전히 같은 계약(StorageService)을 구현하기 때문에,
 * storage.module.ts에서 이 클래스로 갈아 끼우기만 하면 컨트롤러/서비스
 * 코드는 한 줄도 바꿀 필요가 없다 — 이게 Mock-first 설계의 핵심 목적이다.
 *
 * 실제로 이 클래스를 쓰려면 (STORAGE_DRIVER=s3로 전환하려면):
 *   1) AWS 계정에서 S3 버킷을 하나 만든다 (예: credobounty-uploads)
 *   2) .env에 아래 값을 채운다
 *        STORAGE_DRIVER=s3
 *        AWS_REGION=ap-northeast-2
 *        AWS_S3_BUCKET=credobounty-uploads
 *        AWS_ACCESS_KEY_ID=...
 *        AWS_SECRET_ACCESS_KEY=...
 *      (자격증명은 AWS IAM에서 "이 버킷에만 업로드 가능한" 최소 권한으로 발급하는 걸 권장 —
 *       루트 계정 키를 그대로 쓰지 않는다)
 *   3) 버킷 정책에서 업로드된 파일을 읽을 수 있게 허용하거나, CloudFront 등을 앞에 둔다
 *      (지금 구현은 버킷이 퍼블릭 읽기 가능하다고 가정한 가장 단순한 URL을 반환한다.
 *       실제 운영에서는 비공개 버킷 + Pre-signed GET URL 방식을 더 권장하며, 이는
 *       Phase 3에서 다룰 개선 포인트로 남겨둔다)
 *
 * 지금 이 프로젝트는 AWS 자격증명이 없는 상태이므로, 이 클래스는 "코드로는 준비되어
 * 있지만 아직 실제로 쓰이지 않는" 상태다 (기본값은 여전히 Mock — storage.module.ts 참고).
 * =========================================================================
 */
@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.client = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  }

  async saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): Promise<string> {
    const ext = validateUploadedFile(originalName, buffer, maxSizeBytes);
    const key = `${randomUUID()}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: this.guessContentType(ext),
        }),
      );
    } catch (err) {
      // AWS 쪽 원인(자격증명 오류, 버킷 권한 등)을 서버 로그에는 자세히 남기되,
      // 사용자에게는 "파일 저장에 실패했다" 정도만 알려준다 (AllExceptionsFilter와 같은 원칙).
      this.logger.error('S3 업로드 실패', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException('파일 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    return `https://${this.bucket}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  }

  private guessContentType(ext: string): string {
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.zip': 'application/zip',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
