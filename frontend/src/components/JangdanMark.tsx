/**
 * =========================================================================
 * JangdanMark — CredoBounty의 브랜드 시그니처 마크.
 * =========================================================================
 * 네 개의 막대가 점점 높아지는 형태 = 사물놀이 장단이 느린 박(진양조)에서
 * 빠르고 힘있는 박(휘모리)으로 쌓여가는 구조를 아주 절제된 형태로 추상화한 것.
 * 오방색(청/적/황/백/흑) 중 적색은 이 프로젝트에서 "위험/이의제기" 상태 전용
 * 색으로 예약해뒀기 때문에(Stripe식 "색 = 상태 신호" 원칙), 장식적 요소인 이
 * 마크에는 나머지 네 색(teal·blue·amber·navy)만 쓴다 - 다섯 색을 다 쓰면
 * 장식이 과해지고, 색의 의미(상태 신호)와도 충돌하기 때문이다.
 *
 * animated=true면 막대가 장단 리듬(간격이 점점 좁아지는 스태거)으로 오르내리는
 * 로딩 인디케이터가 되고, 기본값(false)이면 로고/브랜드 마크로 쓰는 정적 버전이다.
 * =========================================================================
 */
import { jangdanDelay } from '@/lib/motion';

// 밝은 배경(surface-canvas)용 - 마지막 막대는 navy로 마무리해 장단의 "묵직한 종지음" 느낌을 준다.
const BAR_COLORS_LIGHT = ['bg-brand-teal', 'bg-brand-blue', 'bg-brand-amber', 'bg-brand-navy'];
// 어두운 배경(네이비 히어로/헤더)용 - navy 막대는 배경에 묻히므로 흰색 계열로 교체.
const BAR_COLORS_DARK = ['bg-brand-teal', 'bg-brand-blue', 'bg-brand-amber', 'bg-white'];
const BAR_HEIGHTS = [0.35, 0.55, 0.8, 1];

export function JangdanMark({
  size = 20,
  animated = false,
  variant = 'light',
  className = '',
}: {
  size?: number;
  animated?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const barWidth = Math.max(2, Math.round(size / 7));
  const gap = Math.max(1, Math.round(size / 12));
  const colors = variant === 'dark' ? BAR_COLORS_DARK : BAR_COLORS_LIGHT;

  return (
    <span
      className={`inline-flex flex-shrink-0 items-end ${className}`}
      style={{ height: size, gap }}
      aria-hidden="true"
    >
      {BAR_HEIGHTS.map((h, i) => (
        <span
          key={i}
          className={`rounded-full ${colors[i]} ${animated ? 'animate-jangdan-bar' : ''}`}
          style={{
            width: barWidth,
            height: Math.round(size * h),
            ...(animated ? jangdanDelay(i) : {}),
          }}
        />
      ))}
    </span>
  );
}
