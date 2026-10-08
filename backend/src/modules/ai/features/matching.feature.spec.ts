import {
  EXPERT_FIT_MAX,
  BOUNTY_FIT_MAX,
  buildExpertMatchPrompt,
  competitionPts,
  experiencePts,
  freshnessPts,
  ruleTopicFit,
  validateMatchFits,
} from './matching.feature';

describe('AI 매칭 계산', () => {
  const labels = ['후보 A', '후보 B'];
  const ok = { fits: [{ label: '후보 A', score: 20, reason: '주제 유사' }, { label: '후보 B', score: 3, reason: '거리 있음' }] };

  it('정상 출력은 통과한다', () => {
    const m = validateMatchFits(ok, labels, EXPERT_FIT_MAX);
    expect(m?.get('후보 A')?.score).toBe(20);
  });

  it('범위를 벗어난 점수, 모르는 라벨, 누락, 소수 점수는 전체를 버린다', () => {
    expect(validateMatchFits({ fits: [{ ...ok.fits[0], score: 26 }, ok.fits[1]] }, labels, EXPERT_FIT_MAX)).toBeNull();
    expect(validateMatchFits({ fits: [{ ...ok.fits[0], score: -1 }, ok.fits[1]] }, labels, EXPERT_FIT_MAX)).toBeNull();
    // 요청한 라벨이 하나도 없으면(전부 모르는 라벨) 버린다
    expect(validateMatchFits({ fits: [{ ...ok.fits[0], label: '후보 Z' }] }, labels, EXPERT_FIT_MAX)).toBeNull();
    expect(validateMatchFits({ fits: [] }, labels, EXPERT_FIT_MAX)).toBeNull();
    expect(validateMatchFits({ fits: [{ ...ok.fits[0], score: 12.5 }, ok.fits[1]] }, labels, EXPERT_FIT_MAX)).toBeNull();
  });

  it('모델이 무관한 항목을 통째로 빼면 0점으로 채운다(점수를 부풀리지 않는 쪽으로만 보정)', () => {
    const m = validateMatchFits({ fits: [ok.fits[0]] }, labels, EXPERT_FIT_MAX);
    expect(m?.get('후보 A')?.score).toBe(20);
    expect(m?.get('후보 B')?.score).toBe(0);
    expect(m?.get('후보 B')?.reason).toContain('0점');
  });

  it('요청하지 않은 라벨은 무시하고, 비어 있는 이유는 기본 문구로 채운다(점수 검증은 그대로)', () => {
    const extra = { fits: [...ok.fits, { label: '후보 Z', score: 99, reason: '무관' }] };
    expect(validateMatchFits(extra, labels, EXPERT_FIT_MAX)?.size).toBe(2);
    const noReason = validateMatchFits({ fits: [{ ...ok.fits[0], reason: '' }, ok.fits[1]] }, labels, EXPERT_FIT_MAX);
    expect(noReason?.get('후보 A')?.reason).toContain('근거를 적지 않음');
    expect(validateMatchFits({ fits: [{ ...ok.fits[0], reason: '' }, { ...ok.fits[1], score: 30 }] }, labels, EXPERT_FIT_MAX)).toBeNull();
  });

  it('공고쪽 점수 상한은 50이다', () => {
    const j = { fits: [{ label: '공고 A', score: 50, reason: '일치' }] };
    expect(validateMatchFits(j, ['공고 A'], BOUNTY_FIT_MAX)).not.toBeNull();
    expect(validateMatchFits({ fits: [{ label: '공고 A', score: 51, reason: '일치' }] }, ['공고 A'], BOUNTY_FIT_MAX)).toBeNull();
  });

  it('규칙 기반 적합도: 이력이 없으면 0점, 겹치는 단어가 많으면 높다', () => {
    expect(ruleTopicFit('쿼리 튜닝', [], 25).score).toBe(0);
    const hi = ruleTopicFit('주문 조회 쿼리 인덱스 튜닝', ['주문 조회 쿼리 인덱스 튜닝'], 25);
    const lo = ruleTopicFit('주문 조회 쿼리 인덱스 튜닝', ['근로계약서 검토'], 25);
    expect(hi.score).toBeGreaterThan(lo.score);
    expect(hi.score).toBeLessThanOrEqual(25);
  });

  it('경력·최신성·경쟁 점수는 정해진 범위 안에 있다', () => {
    expect(experiencePts(0)).toBe(0);
    expect(experiencePts(3)).toBe(6);
    expect(experiencePts(99)).toBe(10);
    const now = new Date('2026-10-08T00:00:00Z');
    expect(freshnessPts(new Date('2026-10-07T00:00:00Z'), now)).toBe(10);
    expect(freshnessPts(new Date('2026-10-03T00:00:00Z'), now)).toBe(6);
    expect(freshnessPts(new Date('2026-09-28T00:00:00Z'), now)).toBe(3);
    expect(freshnessPts(new Date('2026-08-01T00:00:00Z'), now)).toBe(0);
    expect(competitionPts(0)).toBe(10);
    expect(competitionPts(2)).toBe(6);
    expect(competitionPts(9)).toBe(2);
  });

  it('AI에 보내는 프롬프트에는 이름·이메일·ID가 들어가지 않고 라벨만 있다', () => {
    const p = buildExpertMatchPrompt('쿼리 튜닝', '설명', [{ label: '후보 A', titles: ['인덱스 개선'] }]);
    expect(p).toContain('후보 A');
    expect(p).not.toMatch(/@|uuid|expertId/i);
  });
});
