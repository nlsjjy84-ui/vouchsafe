import { BadRequestException } from '@nestjs/common';

/**
 * 보안 강화 2탄 — "매직바이트(시그니처) 검증".
 * 확장자만 보고 파일 종류를 믿으면, 실행 파일을 .png로 확장자만 바꿔 올리는 식의 위장
 * 공격을 막을 수 없다. 파일의 실제 첫 바이트들(시그니처)이 그 확장자가 규정하는 형식과
 * 일치하는지 직접 대조한다 — 서버가 클라이언트가 "주장하는" 타입이 아니라 "실제로 보내온
 * 바이트"를 근거로 판단하게 만드는 것이 핵심이다.
 */
type SignatureCheck = (buf: Buffer) => boolean;

const SIGNATURES: Record<string, SignatureCheck> = {
  '.pdf': (buf) => buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-',
  '.png': (buf) =>
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  '.jpeg': (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  // ZIP: 로컬 파일 헤더(PK\x03\x04), 빈 아카이브(PK\x05\x06), 분할 아카이브(PK\x07\x08) 모두 허용
  '.zip': (buf) =>
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07),
};

export const ALLOWED_UPLOAD_EXTENSIONS = Object.keys(SIGNATURES);

/** 확장자 화이트리스트 검사 + 매직바이트 대조를 한 번에 수행. 실패 시 400. */
export function validateFileSignature(originalName: string, buffer: Buffer): void {
  const dotIndex = originalName.lastIndexOf('.');
  const ext = dotIndex >= 0 ? originalName.slice(dotIndex).toLowerCase() : '';
  const check = SIGNATURES[ext];
  if (!check) {
    throw new BadRequestException(
      `허용되지 않는 파일 형식입니다: ${ext || '(확장자 없음)'} — 허용: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`,
    );
  }
  if (!check(buffer)) {
    throw new BadRequestException(
      `파일 내용이 확장자(${ext})와 일치하지 않습니다 — 확장자를 위장한 파일일 수 있습니다.`,
    );
  }
}
