import { CheckCircle2 } from 'lucide-react';
import { ReactNode } from 'react';

/**
 * 성공 액션(정산 승인, 가입 완료, 비밀번호 변경 등)에 쓰는 축하 배지.
 * 토스가 송금/결제 완료 순간에 체크마크 + 짧은 펄스 애니메이션으로 "이 행동이
 * 잘 끝났다"는 감정적 신호를 주는 패턴을 참고했다 - 색은 상태 신호(성공=teal)로만
 * 쓰고, 화려한 컨페티 대신 링이 한 번 은은하게 번지는 정도로 절제했다.
 */
export function SuccessPulse({ children }: { children: ReactNode }) {
  return (
    <div className="animate-stagger-in flex items-center gap-3 rounded-lg bg-tint-teal px-4 py-3 text-sm text-brand-teal">
      <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-success-ring rounded-full bg-brand-teal/30" />
        <CheckCircle2 size={22} className="relative" strokeWidth={2} />
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
