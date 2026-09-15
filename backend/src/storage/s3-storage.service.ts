import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { StorageService } from './storage.interface';
import { validateFileSignature } from './magic-byte-validator';

/**
 * StorageService의 실제 AWS S3 구현체.
 * MockStorageService와 똑같은 검증 규칙(용도별 용량 상한 + 매직바이트 대조)을 그대로
 * 재사용해서, "로컬 개발 때는 통과했는데 운영에서는 막힌다" 같은 환경 간 불일치가 없게 했다.
 *
 * AWS 계정/버킷이 아직 없는 지금 단계에서는 STORAGE_DRIVER=s3로 바꿔도 자격증명이
 * 없으면 실제 업로드 시점에 에러가 나는 게 당연하다 — 이 클래스의 목적은
 * "나중에 AWS_* 환경변수만 채워 넣으면 바로 동작하는 상태"를 미리 만들어두는 것.
 */
@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly bucket = process.env.AWS_S3_BUCKET ?? '';
  private readonly client = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
    // 자격증명을 명시적으로 안 넘기면 SDK가 표준 체인(환경변수/EC2 role 등)을 따라간다.
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  async saveFile(originalName: string, buffer: Buffer, maxSizeBytes: number): Promise<string> {
    if (buffer.length > maxSizeBytes) {
      throw new BadRequestException(
        `파일 용량이 ${Math.floor(maxSizeBytes / (1024 * 1024))}MB를 초과했습니다`,
      );
    }
    validateFileSignature(originalName, buffer);
    const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'STORAGE_DRIVER=s3 인데 AWS_S3_BUCKET이 설정되지 않았습니다',
      );
    }

    const key = `${randomUUID()}${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer }),
      );
    } catch (err) {
      this.logger.error(`S3 업로드 실패: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('파일 업로드 중 오류가 발생했습니다');
    }

    return `https://${this.bucket}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  }
}
