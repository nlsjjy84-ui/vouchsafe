import { BadRequestException } from '@nestjs/common';

/**
 * 기획서 7장 "S3 Pre-signed URL 발급 전 백엔드에서 확장자 필터링과 용량 제한을 강제"
 * 규칙. Mock 저장소든 실제 S3든 "어떤 파일을 받아줄지"는 완전히 동일해야 하므로,
 * 두 구현체(MockStorageService, S3StorageService)가 이 함수 하나를 공유한다 —
 * 검증 로직이 두 군데로 복사되면 나중에 한쪽만 고치고 잊어버리는 사고가 나기 쉽다.
 *
 * [보안 강화] 용도에 따라 용량 상한을 다르게 뒀다:
 *  - 자격 인증 증빙서류(자격증/사업자등록증 사진·스캔본)는 여러 페이지짜리 PDF까지
 *    감안해 15MB
 *  - 바운티 결과물(코드 zip, 진단서 PDF 등)은 조금 더 커질 수 있어 20MB
 * 이전에는 두 용도가 50MB 하나를 같이 썼는데, 실제로 올라오는 파일들 기준으로 보면
 * 지나치게 넉넉한 값이라 불필요하게 공격 표면(대용량 업로드로 인한 메모리 부담)을
 * 키우고 있었다.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.zip'];
export const MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_RESULT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * [보안 강화] 확장자만 보고 통과시키던 것을, 실제 파일의 "매직바이트"(파일 맨 앞
 * 몇 바이트에 찍히는 고유 시그니처)까지 대조하도록 강화했다. 예를 들어 악성
 * 실행파일의 확장자만 `.png`로 바꿔서 올리는 식의 위장을 막기 위함 - 확장자는
 * 파일 이름에 불과해서 얼마든지 거짓으로 바꿀 수 있지만, 매직바이트는 파일 내용
 * 자체에 찍혀있어 위조하려면 파일 포맷 자체를 실제로 그렇게 만들어야 한다.
 *
 * ZIP은 로컬 파일 헤더(PK\x03\x04) 외에도 "비어있는 zip"(PK\x05\x06)이나
 * "분할 압축"(PK\x07\x08) 시그니처가 있을 수 있어 셋 다 허용한다.
 */
const MAGIC_BYTE_SIGNATURES: Record<string, Buffer[]> = {
  '.pdf': [Buffer.from('25504446', 'hex')], // %PDF
  '.png': [Buffer.from('89504e470d0a1a0a', 'hex')],
  '.jpg': [Buffer.from('ffd8ff', 'hex')],
  '.jpeg': [Buffer.from('ffd8ff', 'hex')],
  '.zip': [
    Buffer.from('504b0304', 'hex'),
    Buffer.from('504b0506', 'hex'),
    Buffer.from('504b0708', 'hex'),
  ],
};

function matchesSignature(buffer: Buffer, signatures: Buffer[]): boolean {
  return signatures.some((sig) => buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig));
}

export function validateUploadedFile(originalName: string, buffer: Buffer, maxSizeBytes: number): string {
  if (buffer.length > maxSizeBytes) {
    throw new BadRequestException(`파일 용량이 ${Math.floor(maxSizeBytes / (1024 * 1024))}MB를 초과했습니다`);
  }
  const ext = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    throw new BadRequestException(`허용되지 않는 파일 형식입니다: ${ext}`);
  }

  const signatures = MAGIC_BYTE_SIGNATURES[ext];
  if (signatures && !matchesSignature(buffer, signatures)) {
    throw new BadRequestException(
      `파일 내용이 ${ext} 형식과 일치하지 않습니다 (확장자만 바꾼 파일일 수 있습니다)`,
    );
  }

  return ext;
}
