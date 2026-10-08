import { buildFacets } from './regions.service';
import { normalizeSido, regionText } from './region.util';

describe('region util', () => {
  it('시도 긴 이름을 짧게 통일한다', () => {
    expect(normalizeSido('서울특별시')).toBe('서울');
    expect(normalizeSido('경기도')).toBe('경기');
    expect(normalizeSido('제주특별자치도')).toBe('제주');
    expect(normalizeSido('서울')).toBe('서울');
    expect(normalizeSido('알 수 없음')).toBe('알 수 없음');
  });
  it('지역 문구를 이어 붙인다', () => {
    expect(regionText({ sido: '서울', sigungu: '성동구', dong: '성수동' })).toBe('서울 성동구 성수동');
    expect(regionText({ sido: '서울', sigungu: null, dong: null })).toBe('서울');
  });
});

describe('buildFacets', () => {
  it('시도 > 시군구 > 동 건수를 센다', () => {
    const f = buildFacets([
      { sido: '서울', sigungu: '성동구', dong: '성수동' },
      { sido: '서울', sigungu: '성동구', dong: '성수동' },
      { sido: '서울', sigungu: '성동구', dong: '행당동' },
      { sido: '서울', sigungu: '강남구', dong: null },
      { sido: '부산', sigungu: null, dong: null },
    ]);
    expect(f[0].name).toBe('서울');
    expect(f[0].count).toBe(4);
    expect(f[0].children[0]).toMatchObject({ name: '성동구', count: 3 });
    expect(f[0].children[0].children[0]).toMatchObject({ name: '성수동', count: 2 });
    expect(f[1]).toMatchObject({ name: '부산', count: 1 });
  });
});
