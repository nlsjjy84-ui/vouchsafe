import { ruleBasedRequirements, validateRequirements, toItems } from './features/requirements.feature';
import { effortScore, ruleFit, validateFits } from './features/ranking.feature';
import { ruleBasedChecks, validateChecks } from './features/submission-check.feature';
import {
  ruleBasedDisputeSummary,
  validateDisputeSummary,
  factsCorpus,
} from './features/dispute-summary.feature';
import {
  allocateAmounts,
  computeStats,
  positionOf,
  ruleBasedMilestones,
  validateMilestones,
  validatePriceComment,
} from './features/price-milestone.feature';

describe('기능 1 요구사항', () => {
  it('형식이 어긋난 출력은 null', () => {
    expect(validateRequirements({ items: 'x' })).toBeNull();
    expect(validateRequirements({ items: ['하나뿐'] })).toBeNull();
    expect(validateRequirements({ items: ['조건 하나', '조건 둘', '조건 하나'] })).toEqual(['조건 하나', '조건 둘']);
  });
  it('규칙 기반은 요구 표현이 있는 문장을 고른다', () => {
    const items = ruleBasedRequirements('안녕하세요. 쿼리 실행계획 보고서를 제출해야 합니다. 일정은 유동적입니다. 인덱스 개선안을 포함해 주세요.');
    expect(items.some((i) => i.includes('보고서'))).toBe(true);
    expect(toItems(items)[0].id).toBe('R1');
  });
  it('빈 설명이어도 최소 1개', () => {
    expect(ruleBasedRequirements('').length).toBe(1);
  });
});

describe('기능 2 지원자 점수', () => {
  const labels = ['지원자 A', '지원자 B'];
  it('모든 라벨, 0~20 정수, 근거가 있어야 통과', () => {
    const ok = { fits: [{ label: '지원자 A', score: 15, reason: '맞음' }, { label: '지원자 B', score: 3, reason: '약함' }] };
    expect(validateFits(ok, labels)?.get('지원자 A')?.score).toBe(15);
    expect(validateFits({ fits: [{ label: '지원자 A', score: 15, reason: '맞음' }] }, labels)).toBeNull();
    expect(validateFits({ fits: [{ label: '지원자 A', score: 99, reason: 'x' }, { label: '지원자 B', score: 1, reason: 'y' }] }, labels)).toBeNull();
    expect(validateFits({ fits: [{ label: '홍길동', score: 5, reason: 'x' }, { label: '지원자 B', score: 1, reason: 'y' }] }, labels)).toBeNull();
  });
  it('성의 점수는 200자에서 만점', () => {
    expect(effortScore('')).toBe(0);
    expect(effortScore('가'.repeat(100))).toBe(5);
    expect(effortScore('가'.repeat(500))).toBe(10);
  });
  it('규칙 기반 적합도는 단어 겹침', () => {
    expect(ruleFit('쿼리 튜닝 인덱스 실행계획', '인덱스와 실행계획 분석 경험이 있습니다').score).toBeGreaterThan(0);
    expect(ruleFit('쿼리 튜닝', '').score).toBe(0);
  });
});

describe('기능 3 제출물 점검', () => {
  const reqs = [{ id: 'R1', text: '실행계획 보고서를 제출한다' }, { id: 'R2', text: '인덱스 개선안을 포함한다' }];
  const note = '실행계획 보고서를 첨부했습니다.';
  it('MET인데 메모에 없는 인용이면 AI 결과를 버린다', () => {
    const bad = { checks: [
      { id: 'R1', verdict: 'MET', evidence: '실행계획 보고서를 첨부했습니다.', comment: '' },
      { id: 'R2', verdict: 'MET', evidence: '인덱스 개선안도 포함했습니다', comment: '' },
    ] };
    expect(validateChecks(bad, reqs, note)).toBeNull();
  });
  it('인용이 맞으면 통과, UNVERIFIABLE은 인용 불필요', () => {
    const ok = { checks: [
      { id: 'R1', verdict: 'MET', evidence: '실행계획 보고서를 첨부했습니다.', comment: '확인' },
      { id: 'R2', verdict: 'UNVERIFIABLE', comment: '메모에 언급 없음' },
    ] };
    const r = validateChecks(ok, reqs, note);
    expect(r?.[0].verdict).toBe('MET');
    expect(r?.[1].evidence).toBeNull();
  });
  it('요구사항이 빠지면 null', () => {
    expect(validateChecks({ checks: [{ id: 'R1', verdict: 'UNVERIFIABLE', comment: '' }] }, reqs, note)).toBeNull();
  });
  it('규칙 기반은 NOT_MET을 절대 내지 않는다', () => {
    const r = ruleBasedChecks(reqs, '아무 관련 없는 메모입니다');
    expect(r.every((l) => l.verdict !== 'NOT_MET')).toBe(true);
    expect(r[0].verdict).toBe('UNVERIFIABLE');
    expect(ruleBasedChecks(reqs, note)[0].verdict).toBe('MET');
  });
});

describe('기능 4 분쟁 요약', () => {
  const facts = {
    bountyTitle: '쿼리 튜닝', bountyDescription: '느린 쿼리 개선', amount: 300000,
    disputeReason: '보고서가 부실합니다', requirements: [], submissionNotes: ['보고서 제출'], submissionCount: 2,
  };
  const corpus = factsCorpus(facts);
  const base = { summary: '의뢰인이 보고서가 부실하다고 주장합니다. 제출은 2회입니다.', clientPoints: ['보고서가 부실하다는 주장'], expertPoints: ['보고서 제출함'], checkpoints: ['보고서 내용을 직접 확인'] };
  it('중립 요약은 통과', () => {
    expect(validateDisputeSummary(base, corpus)).not.toBeNull();
  });
  it('판정 표현이 있으면 버린다', () => {
    expect(validateDisputeSummary({ ...base, summary: '전문가 귀책이므로 환불해야 합니다' }, corpus)).toBeNull();
  });
  it('지어낸 숫자가 있으면 버린다', () => {
    expect(validateDisputeSummary({ ...base, summary: '제출은 7회입니다' }, corpus)).toBeNull();
  });
  it('규칙 기반 요약은 판정 표현이 없다', () => {
    const r = ruleBasedDisputeSummary(facts);
    expect(validateDisputeSummary(r, corpus)).not.toBeNull();
  });
});

describe('기능 5 가격 참고', () => {
  it('3건 미만이면 통계 없음', () => {
    expect(computeStats([100000, 200000])).toBeNull();
  });
  it('백분위와 위치', () => {
    const st = computeStats([100000, 200000, 300000, 400000, 500000])!;
    expect(st.median).toBe(300000);
    expect(positionOf(50000, st)).toBe('LOW');
    expect(positionOf(300000, st)).toBe('IN_RANGE');
    expect(positionOf(900000, st)).toBe('HIGH');
  });
  it('해설의 숫자는 통계/금액 안에 있어야 한다', () => {
    const st = computeStats([100000, 200000, 300000])!;
    expect(validatePriceComment({ comment: `중앙값은 ${st.median}원입니다` }, st, 250000)).not.toBeNull();
    expect(validatePriceComment({ comment: '평균 777777원입니다' }, st, 250000)).toBeNull();
  });
});

describe('기능 6 마일스톤', () => {
  it('금액 합이 총액과 정확히 같고 각 1,000원 이상', () => {
    for (const total of [10000, 300001, 999999, 3000]) {
      const a = allocateAmounts(total, [30, 40, 30])!;
      expect(a.reduce((x, y) => x + y, 0)).toBe(total);
      expect(a.every((x) => x >= 1000)).toBe(true);
    }
  });
  it('금액이 너무 작으면 null', () => {
    expect(allocateAmounts(1500, [50, 50])).toBeNull();
    expect(ruleBasedMilestones(1500)).toBeNull();
  });
  it('AI 비율 출력을 서버가 금액으로 바꾼다', () => {
    const r = validateMilestones({ milestones: [{ title: '분석', ratio: 3 }, { title: '개선', ratio: 7 }] }, 100000)!;
    expect(r.reduce((s, m) => s + m.amount, 0)).toBe(100000);
  });
  it('1개 또는 비율 0은 거부', () => {
    expect(validateMilestones({ milestones: [{ title: 'a', ratio: 1 }] }, 100000)).toBeNull();
    expect(validateMilestones({ milestones: [{ title: 'a', ratio: 0 }, { title: 'b', ratio: 1 }] }, 100000)).toBeNull();
  });
});
