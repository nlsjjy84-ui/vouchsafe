/**
 * =========================================================================
 * 장단(jangdan) 리듬 모션 — 이 프로젝트의 시그니처 모션 원칙.
 * =========================================================================
 * 사물놀이/풍물 장단은 느리고 성긴 박(진양조)에서 시작해 점점 촘촘하고 빠른
 * 박(자진모리→휘모리)으로 쌓여간다. 이 "간격이 점점 좁아지는 점층적 리듬" 구조를
 * 그대로 UI의 리스트/카드 등장 애니메이션에 옮겨왔다 - 흔한 "일정한 간격의
 * stagger"가 아니라, 처음엔 여유 있게 하나씩, 뒤로 갈수록 빠르게 몰아치며
 * 나타나는 방식이다. 겉으로는 "세련된 등장 효과"로만 보이지만, 알고 찾아보면
 * 장단의 구조를 그대로 반영한 의도적인 디자인 시그니처다.
 *
 * 사용법: 리스트를 렌더링할 때 각 항목에
 *   style={jangdanDelay(index)} className="animate-stagger-in"
 * 를 붙이면 된다.
 * =========================================================================
 */

// 누적 지연시간(ms). 간격이 220 → 60ms로 점점 좁아진다 (진양조 → 휘모리).
const JANGDAN_OFFSETS = [0, 220, 400, 540, 640, 715, 775, 825, 865, 900, 930];

export function jangdanDelay(index: number): { animationDelay: string } {
  const ms =
    index < JANGDAN_OFFSETS.length
      ? JANGDAN_OFFSETS[index]
      : JANGDAN_OFFSETS[JANGDAN_OFFSETS.length - 1] + (index - JANGDAN_OFFSETS.length + 1) * 25;
  return { animationDelay: `${ms}ms` };
}
