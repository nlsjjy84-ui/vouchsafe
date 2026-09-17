/**
 * =========================================================================
 * Decor — concept-c의 원형·블롭 장식 요소를 실제 화면에서 재사용할 수 있게
 * 뽑아둔 공용 컴포넌트.
 * =========================================================================
 * 2026-09-17: 예전엔 "형태만 concept-c, 색은 기존 brand.teal/amber/blue 유지"로
 * 절충했었는데, 그 절충 자체가 "여전히 같은 색"이라는 인상을 남겨 재지적을 받았다.
 * 이제는 색도 concept-c 방향(클레이/세이지/골드)으로 완전히 넘어갔으므로, 기본값도
 * tailwind.config.ts의 새 brand.clay/brand.sage 색을 그대로 반영한다. 호출부에서
 * 다른 색을 쓰고 싶으면 여전히 color prop으로 자유롭게 덮어쓸 수 있다.
 *
 * - RippleRings: 징/북소리가 퍼지는 동심원 파동 모티프 (concept-c).
 * - Blob: 손으로 그린 듯한 비정형 곡선 (concept-c) - rounded-none 각진 습관을 벗어난
 *   형태 언어. 히어로/CTA 배경 장식용, 클릭 불가능하도록 항상 pointer-events-none과
 *   함께 쓴다.
 * =========================================================================
 */

export function RippleRings({
  className = '',
  color = '#c2410c',
  animated = false,
}: {
  className?: string;
  color?: string;
  animated?: boolean;
}) {
  const radii = [40, 80, 120, 160];
  return (
    <svg
      viewBox="0 0 340 340"
      className={`${className} ${animated ? 'animate-ripple-pulse' : ''}`}
      fill="none"
      aria-hidden="true"
    >
      {radii.map((r) => (
        <circle key={r} cx="170" cy="170" r={r} stroke={color} strokeWidth="1.5" opacity={1 - r / 220} />
      ))}
    </svg>
  );
}

export function Blob({
  className = '',
  color = '#f4c98b',
  animated = false,
}: {
  className?: string;
  color?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`${className} ${animated ? 'animate-blob-float' : ''}`}
      aria-hidden="true"
    >
      <path
        fill={color}
        d="M45.2,-58.3C58.4,-49.6,68.9,-33.9,72.1,-16.6C75.3,0.7,71.2,19.6,60.8,34.5C50.4,49.4,33.7,60.3,15.4,65.8C-2.9,71.3,-22.8,71.4,-38.9,63.1C-55,54.8,-67.3,38.1,-71.8,19.6C-76.3,1.1,-73,-19.2,-62.6,-34.8C-52.2,-50.4,-34.7,-61.3,-16.2,-66.8C2.3,-72.3,32,-67,45.2,-58.3Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}
