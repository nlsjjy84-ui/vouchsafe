import { MockVerificationService } from './mock-verification.service';

/**
 * 유닛 테스트 — MockVerificationService (자격 인증 OCR mock, 본인인증 CI 발급)
 * "SHA-256 시드로 결정론적 판정을 내린다"는 설계 자체가 핵심 검증 대상이다 —
 * 같은 입력이면 언제 호출해도 항상 같은 결과가 나와야 한다(재현 가능성).
 */
describe('MockVerificationService', () => {
  let service: MockVerificationService;

  beforeEach(() => {
    service = new MockVerificationService();
  });

  it('증빙번호가 4자 미만이면 1단계 형식검증에서 즉시 REJECTED', async () => {
    const result = await service.verifyCertification('abc');
    expect(result.status).toBe('REJECTED');
    expect(result.note).toContain('형식검증 실패');
  });

  it('같은 증빙번호를 두 번 검증해도 항상 같은 결과가 나온다 (결정론적)', async () => {
    const first = await service.verifyCertification('LIC-000123');
    const second = await service.verifyCertification('LIC-000123');
    expect(first.status).toBe(second.status);
  });

  it('서로 다른 증빙번호는 (대체로) 서로 다른 결과가 나올 수 있다 — 전부 같은 값으로 하드코딩되지 않았음을 확인', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => service.verifyCertification(`SEED-${i}`)),
    );
    const statuses = new Set(results.map((r) => r.status));
    // 20개 정도 뽑으면 APPROVED/PENDING 최소 두 종류 이상은 섞여 나와야 "고정값"이 아니다
    expect(statuses.size).toBeGreaterThan(1);
  });

  it('generateCiHash는 64자 hex 문자열(SHA-256)을 반환한다', () => {
    const ci = service.generateCiHash('user@test.com');
    expect(ci).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateCiHash는 같은 이메일이라도 호출마다 다른 값을 반환한다 (매번 랜덤 salt 포함)', () => {
    const first = service.generateCiHash('same@test.com');
    const second = service.generateCiHash('same@test.com');
    expect(first).not.toBe(second);
  });
});
