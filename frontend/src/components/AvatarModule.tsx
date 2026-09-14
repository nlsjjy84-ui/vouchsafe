/**
 * 기획서 4장 "실물 사진 대신 자격과 역할을 시각화" UI 원칙을 구현한 컴포넌트.
 * 실제 얼굴 사진 대신, 역할(의뢰인/전문가)에 따라 다른 색과 이니셜만 보여준다.
 * 소개팅 앱처럼 외모로 판단하게 되는 걸 막고, "이 사람이 무엇을 검증받았는가"에
 * 시선이 가도록 하려는 의도다.
 */

const ROLE_COLORS: Record<string, string> = {
  CLIENT: 'bg-brand-blue',
  EXPERT: 'bg-brand-teal',
  HYBRID: 'bg-brand-amber',
};

export function AvatarModule({
  name,
  role,
  size = 40,
}: {
  name: string;
  role: 'CLIENT' | 'EXPERT' | 'HYBRID';
  size?: number;
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';
  const colorClass = ROLE_COLORS[role] ?? 'bg-slate-400';

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white ${colorClass}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={role === 'EXPERT' ? '검증된 전문가' : role === 'CLIENT' ? '의뢰인' : '하이브리드'}
    >
      {initial}
    </div>
  );
}
