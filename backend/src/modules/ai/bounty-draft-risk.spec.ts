import { DomainType } from '../../common/enums/domain-type.enum';
import { ruleBasedBountyDraft, validateBountyDraft } from './features/bounty-draft.feature';
import { levelOf, mergeRisk, ruleBasedRisk, validateRisk } from './features/risk-check.feature';

describe('기능 11 프로젝트 등록 도우미', () => {
  const idea = '중고차를 사려는데 엔진 상태랑 사고 이력을 같이 봐줄 사람이 필요해요. 이번 주말에 3대 정도 보려고 해요.';

  it('규칙 기반은 키워드로 분야를 찾고 입력을 그대로 정리한다', () => {
    const d = ruleBasedBountyDraft(idea);
    expect(d.domainType).toBe(DomainType.VEHICLE_DIAGNOSTICS);
    expect(d.title.length).toBeGreaterThanOrEqual(5);
    expect(d.description).toContain('중고차');
    expect(d.missing.length).toBeLessThanOrEqual(3);
  });
  it('분야를 못 찾으면 null로 두어 사람이 고르게 한다', () => {
    expect(ruleBasedBountyDraft('이것저것 도움이 필요합니다 잘 부탁드려요').domainType).toBeNull();
  });
  it('AI 출력 검증: 알 수 없는 분야, 너무 짧은 제목, 지어낸 숫자는 버린다', () => {
    const ok = { domainType: 'VEHICLE_DIAGNOSTICS', title: '중고차 3대 엔진·사고 이력 점검', description: '이번 주말에 중고차 3대를 볼 예정이라 엔진 상태와 사고 이력을 함께 확인해 줄 전문가가 필요합니다.', missing: ['차종이 무엇인가요?'] };
    expect(validateBountyDraft(ok, idea)?.domainType).toBe(DomainType.VEHICLE_DIAGNOSTICS);
    expect(validateBountyDraft({ ...ok, domainType: 'NOPE' }, idea)).toBeNull();
    expect(validateBountyDraft({ ...ok, title: '점검' }, idea)).toBeNull();
    expect(validateBountyDraft({ ...ok, description: `${ok.description} 예산은 50만원입니다.` }, idea)).toBeNull();
    expect(validateBountyDraft({ ...ok, domainType: null }, idea)?.domainType).toBeNull();
    expect(validateBountyDraft({ ...ok, missing: ['a', 'b', 'c', 'd', 'e'] }, idea)?.missing).toHaveLength(3);
  });
});

describe('기능 12 위험 신호 점검', () => {
  it('평범한 의뢰는 신호가 없다', () => {
    const s = ruleBasedRisk('DB 쿼리 실행계획을 분석하고 인덱스 개선안을 보고서로 제출해 주세요.');
    expect(s).toEqual([]);
    expect(levelOf(s)).toBe('NONE');
  });
  it('플랫폼 밖 거래·선입금·개인정보 요구는 HIGH', () => {
    expect(levelOf(ruleBasedRisk('수수료 아끼게 직거래로 해요'))).toBe('HIGH');
    expect(levelOf(ruleBasedRisk('계좌번호 드릴 테니 먼저 입금해 주세요'))).toBe('HIGH');
    expect(levelOf(ruleBasedRisk('확인을 위해 인증번호와 신분증 사진을 보내 주세요'))).toBe('HIGH');
  });
  it('연락처 교환은 MEDIUM, 단독 과장·재촉은 LOW', () => {
    expect(levelOf(ruleBasedRisk('카톡으로 연락 주세요'))).toBe('MEDIUM');
    expect(levelOf(ruleBasedRisk('010-1234-5678 입니다'))).toBe('MEDIUM');
    expect(levelOf(ruleBasedRisk('100% 보장합니다'))).toBe('LOW');
    expect(levelOf(ruleBasedRisk('지금 당장 결정해 주세요'))).toBe('LOW');
  });
  it('약한 신호가 둘 이상이면 MEDIUM', () => {
    expect(levelOf(ruleBasedRisk('100% 보장합니다. 지금 당장 결정해 주세요'))).toBe('MEDIUM');
  });
  it('AI 신호는 원문에 있는 인용만 인정하고 알 수 없는 종류는 버린다', () => {
    const text = '자세한 건 외부 채널에서 이야기해요. 저를 믿고 맡겨 주세요.';
    const out = validateRisk(
      { signals: [
        { type: 'OFF_PLATFORM', quote: '외부 채널에서 이야기해요', why: '플랫폼 밖 대화 유도' },
        { type: 'OFF_PLATFORM', quote: '지어낸 문장입니다', why: 'x' },
        { type: 'WEIRD', quote: '저를 믿고', why: 'x' },
      ] },
      text,
    );
    expect(out).toHaveLength(1);
    expect(out?.[0].source).toBe('AI');
    expect(validateRisk({ signals: 'x' }, text)).toBeNull();
  });
  it('합칠 때 같은 종류는 규칙 신호를 우선하고, 등급은 신호 종류로 계산한다', () => {
    const rule = ruleBasedRisk('카톡으로 연락 주세요');
    const merged = mergeRisk(rule, [
      { type: 'CONTACT', quote: '카톡', why: 'x', source: 'AI' },
      { type: 'ADVANCE_PAYMENT', quote: '먼저 입금', why: 'x', source: 'AI' },
    ]);
    expect(merged.signals.filter((s) => s.type === 'CONTACT')).toHaveLength(1);
    expect(merged.level).toBe('HIGH');
  });
});
