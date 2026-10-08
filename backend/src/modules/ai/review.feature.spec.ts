import {
  ReviewFacts,
  reviewDraftCorpus,
  ruleBasedReviewDraft,
  ruleBasedReviewSummary,
  validateReviewDraft,
  validateReviewSummary,
} from './features/review.feature';

describe('기능 9 후기 작성 도우미', () => {
  const facts: ReviewFacts = {
    domainLabel: '차량 정밀 기술 진단',
    durationDays: 3,
    submissionCount: 1,
    wentThroughDispute: false,
    rating: 9,
    keywords: ['응답이 빨랐어요', '결과가 정확했어요'],
    hint: '',
  };
  const corpus = reviewDraftCorpus(facts);

  it('근거 있는 문장은 통과', () => {
    const note = '진단 결과가 정확했고 응답도 빨랐습니다. 3일 만에 끝나서 만족합니다.';
    expect(validateReviewDraft({ note }, corpus)).toBe(note);
  });
  it('입력에 없는 숫자, 연락처, 링크, 너무 짧은 글은 버린다', () => {
    expect(validateReviewDraft({ note: '정말 좋았어요. 7번이나 수정해 주셨습니다.' }, corpus)).toBeNull();
    expect(validateReviewDraft({ note: '좋았어요. 010-1234-5678 로 연락 주세요.' }, corpus)).toBeNull();
    expect(validateReviewDraft({ note: '좋았어요 https://example.com 참고하세요' }, corpus)).toBeNull();
    expect(validateReviewDraft({ note: '좋아요' }, corpus)).toBeNull();
    expect(validateReviewDraft({}, corpus)).toBeNull();
  });
  it('규칙 기반은 점수 톤에 맞고 300자를 넘지 않는다', () => {
    expect(ruleBasedReviewDraft(facts)).toContain('만족스럽게');
    const low = ruleBasedReviewDraft({ ...facts, rating: 3, keywords: ['일정이 늦어졌어요'] });
    expect(low).toContain('기대에 미치지 못했');
    expect(low).toContain('다만 일정이 늦어졌어요');
    expect(ruleBasedReviewDraft({ ...facts, hint: 'a'.repeat(500) }).length).toBeLessThanOrEqual(300);
  });
});

describe('기능 10 전문가 후기 요약', () => {
  const items = [
    { rating: 9, note: '설명이 친절하고 결과물이 정확했습니다.' },
    { rating: 8.5, note: '응답이 빨라서 일정이 편했어요.' },
    { rating: 5, note: '결과는 괜찮았지만 소통이 아쉬웠습니다.' },
  ];

  it('후기 문장에서 그대로 따온 인용이 있는 항목만 남긴다', () => {
    const out = validateReviewSummary(
      {
        summary: '설명과 응답 속도를 칭찬하는 후기가 많습니다.',
        strengths: [
          { point: '친절한 설명', quote: '설명이 친절하고' },
          { point: '지어낸 장점', quote: '가격이 아주 저렴했다' },
        ],
        concerns: [{ point: '소통', quote: '소통이 아쉬웠습니다' }],
      },
      items,
    );
    expect(out?.strengths).toHaveLength(1);
    expect(out?.concerns).toHaveLength(1);
    expect(out?.basedOn).toBe(3);
    expect(out?.averageRating).toBe(7.5);
  });
  it('인용이 모두 가짜이거나 형식이 틀리면 null', () => {
    expect(validateReviewSummary({ summary: '요약입니다', strengths: [{ point: 'x', quote: '없는 문장입니다' }], concerns: [] }, items)).toBeNull();
    expect(validateReviewSummary({ summary: '요약', strengths: 'x', concerns: [] }, items)).toBeNull();
  });
  it('요약문에 입력에 없는 숫자가 있으면 null', () => {
    expect(
      validateReviewSummary(
        { summary: '99%가 만족했습니다.', strengths: [{ point: '설명', quote: '설명이 친절하고' }], concerns: [] },
        items,
      ),
    ).toBeNull();
  });
  it('규칙 기반은 평균과 높은/낮은 점수 후기 원문을 보여준다', () => {
    const r = ruleBasedReviewSummary(items);
    expect(r.averageRating).toBe(7.5);
    expect(r.strengths[0].quote).toContain('설명이 친절');
    expect(r.concerns[0].quote).toContain('소통이 아쉬웠');
  });
});
