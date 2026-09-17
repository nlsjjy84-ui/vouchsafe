/**
 * =========================================================================
 * Decor — concept-b/c 합의안(v4)에서 "형태" 쪽으로 채택한 concept-c의 원형·블롭
 * 장식 요소를 실제 화면에서 재사용할 수 있게 뽑아둔 공용 컴포넌트.
 * =========================================================================
 * concept-c 원본은 클레이(#c2410c)/세이지(#5b6b4f) 색으로 그렸지만, 이번 합의에서
 * "색상은 b" 쪽으로 정했기 때문에 색은 항상 brand.teal/brand.amber/brand.blue 같은
 * 기존 브랜드 토큰을 props로 넘겨 쓴다 - 장식 요소도 예외 없이 기존 팔레트를 따른다.
 *
 * - RippleRings: 징/북소리가 퍼지는 동심원 파동 모티프 (concept-c).
 * - Blob: 손으로 그린 듯한 비정형 곡선 (concept-c) - rounded-none 각진 습관을 벗어난
 *   형태 언어. 히어로/CTA 배경 장식용, 클릭 불가능하도록 항상 pointer-events-none과
 *   함께 쓴다.
 * =========================================================================
 */

export function RippleRings({
  className = '',
  color = '#14b8a6',
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
  color = '#14b8a6',
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
