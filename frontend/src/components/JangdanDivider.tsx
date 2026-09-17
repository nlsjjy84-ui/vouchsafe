/**
 * JangdanDivider — 장단(사물놀이 리듬) 모티프를 "타이밍 효과"가 아니라 실제
 * 눈에 보이는 패턴으로 꺼내놓은 섹션 구분선. JangdanMark(브랜드 마크)가 작은
 * 로고 크기로만 쓰이던 걸, 여러 개를 가로로 늘어놓아 "리듬이 반복되는 띠"로
 * 확장했다 - 진양조(느림)→휘모리(빠름)로 점점 촘촘해지는 사물놀이 장단 구조를
 * 반복 패턴 자체로 표현한다. 다른 어떤 핀테크 UI에도 없는, 이 프로젝트만의
 * 시각적 시그니처를 만드는 게 목적이라 landing 같은 브랜드 노출 지점에 쓴다.
 */
import { JangdanMark } from './JangdanMark';

export function JangdanDivider({ repeat = 10 }: { repeat?: number }) {
  return (
    <div className="flex items-center justify-center gap-6 py-2" aria-hidden="true">
      {Array.from({ length: repeat }).map((_, i) => (
        <JangdanMark key={i} size={14} className={i % 3 === 0 ? 'opacity-100' : 'opacity-30'} />
      ))}
    </div>
  );
}
