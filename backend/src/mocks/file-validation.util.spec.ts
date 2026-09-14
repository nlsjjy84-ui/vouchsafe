import { BadRequestException } from '@nestjs/common';
import {
  validateUploadedFile,
  MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES,
} from './file-validation.util';

/**
 * 실제 매직바이트를 가진 최소 크기의 가짜 파일 버퍼를 만들어 테스트한다.
 * "확장자는 맞지만 내용물은 다른 형식" 위장 공격이 실제로 막히는지가 이 유틸의
 * 존재 이유이므로, 그 케이스를 가장 중점적으로 검증한다.
 */
const PDF_BYTES = Buffer.from('255044462d312e34', 'hex'); // %PDF-1.4
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000', 'hex');
const ZIP_BYTES = Buffer.from('504b0304140000000000', 'hex');
const FAKE_EXE_BYTES = Buffer.from('4d5a90000300000004000000', 'hex'); // MZ (Windows PE 실행파일 시그니처)

describe('validateUploadedFile', () => {
  it('확장자와 매직바이트가 일치하는 PDF는 통과하고 확장자를 반환한다', () => {
    expect(validateUploadedFile('cert.pdf', PDF_BYTES, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)).toBe('.pdf');
  });

  it('확장자와 매직바이트가 일치하는 PNG는 통과한다', () => {
    expect(validateUploadedFile('cert.png', PNG_BYTES, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)).toBe('.png');
  });

  it('확장자와 매직바이트가 일치하는 ZIP은 통과한다', () => {
    expect(validateUploadedFile('result.zip', ZIP_BYTES, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)).toBe('.zip');
  });

  it('허용 목록에 없는 확장자는 거부한다', () => {
    expect(() =>
      validateUploadedFile('malware.exe', FAKE_EXE_BYTES, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES),
    ).toThrow(BadRequestException);
  });

  it('확장자만 위장하고 실제 내용은 다른 형식이면 거부한다 (exe를 .png로 위장)', () => {
    expect(() =>
      validateUploadedFile('fake.png', FAKE_EXE_BYTES, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES),
    ).toThrow(/일치하지 않습니다/);
  });

  it('용량 제한을 초과하면 거부한다', () => {
    const oversized = Buffer.alloc(MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES + 1, 0);
    PDF_BYTES.copy(oversized);
    expect(() => validateUploadedFile('cert.pdf', oversized, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)).toThrow(
      /용량이.*초과했습니다/,
    );
  });

  it('용량 제한과 정확히 같은 크기는 통과한다 (경계값)', () => {
    const exact = Buffer.alloc(MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES, 0);
    PDF_BYTES.copy(exact);
    expect(() => validateUploadedFile('cert.pdf', exact, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)).not.toThrow();
  });

  it('대문자 확장자(.PDF)도 소문자로 정규화해서 인식한다', () => {
    expect(validateUploadedFile('CERT.PDF', PDF_BYTES, MAX_CERTIFICATION_EVIDENCE_SIZE_BYTES)).toBe('.pdf');
  });
});
