import { validateFileSignature } from './magic-byte-validator';

/**
 * 유닛 테스트 — validateFileSignature (보안 강화 2탄: 매직바이트 검증)
 * 확장자가 아니라 "파일의 실제 첫 바이트"를 근거로 판정하는지가 핵심이다.
 */
describe('validateFileSignature', () => {
  it('진짜 PNG 시그니처(89 50 4E 47 0D 0A 1A 0A)는 .png로 통과한다', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(() => validateFileSignature('evidence.png', buf)).not.toThrow();
  });

  it('진짜 PDF 시그니처(%PDF-)는 .pdf로 통과한다', () => {
    const buf = Buffer.from('%PDF-1.7\n%âãÏÓ', 'latin1');
    expect(() => validateFileSignature('license.pdf', buf)).not.toThrow();
  });

  it('진짜 JPEG 시그니처(FF D8 FF)는 .jpg/.jpeg로 통과한다', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(() => validateFileSignature('photo.jpg', buf)).not.toThrow();
    expect(() => validateFileSignature('photo.jpeg', buf)).not.toThrow();
  });

  it('진짜 ZIP 시그니처(PK\\x03\\x04)는 .zip으로 통과한다', () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(() => validateFileSignature('result.zip', buf)).not.toThrow();
  });

  it('텍스트 파일을 .png로 확장자만 위장하면 시그니처 불일치로 거부된다', () => {
    const buf = Buffer.from('this is just plain text, not a real png', 'utf8');
    expect(() => validateFileSignature('fake.png', buf)).toThrow(
      '파일 내용이 확장자(.png)와 일치하지 않습니다',
    );
  });

  it('허용 목록에 없는 확장자(.exe 등)는 매직바이트를 볼 것도 없이 즉시 거부된다', () => {
    const buf = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // PE 실행 파일 시그니처
    expect(() => validateFileSignature('malware.exe', buf)).toThrow('허용되지 않는 파일 형식입니다');
  });

  it('확장자가 아예 없는 파일명도 거부된다', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(() => validateFileSignature('noextension', buf)).toThrow('허용되지 않는 파일 형식입니다');
  });
});
