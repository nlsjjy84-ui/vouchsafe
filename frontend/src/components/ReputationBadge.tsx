'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ReputationSummary {
  totalCompleted: number;
  totalConcluded: number;
  completionRate: number | null;
  reputationScore: number | null;
}

/**
 * 지원자 목록에서 "이 전문가를 믿고 선택해도 될까?"를 판단할 수 있게 도와주는
 * 작은 배지. 확장 기획 4장 "평판의 자산화"를 화면에 실제로 노출하는 부분이다.
 * 완료 이력이 아예 없는 신규 전문가는 점수 대신 "신규 전문가"라고 표시해서,
 * "점수 0점이라 나쁜 전문가"처럼 오해되지 않게 한다.
 */
export function ReputationBadge({ expertId }: { expertId: string }) {
  const [summary, setSummary] = useState<ReputationSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ReputationSummary>(`/experts/${expertId}/reputation`)
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [expertId]);

  if (!summary || summary.reputationScore === null) {
    return <span className="text-xs text-slate-400">신규 전문가 (완료 이력 없음)</span>;
  }

  return (
    <span className="text-xs text-slate-500">
      신뢰도 점수 <span className="font-semibold text-brand-teal">{summary.reputationScore}</span>
      {' · '}완료율 {summary.completionRate}%{' · '}완료 {summary.totalCompleted}건
    </span>
  );
}
