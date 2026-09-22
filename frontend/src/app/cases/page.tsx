'use client';

import { useEffect, useState } from 'react';
import { ScrollText, Gauge, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PublicBountyCase, DomainType } from '@/lib/types';
import { JangdanDivider } from '@/components/JangdanDivider';
import { jangdanDelay } from '@/lib/motion';

/**
 * =========================================================================
 * 공개 거래 사례 (/cases) — 로그인 없이도 볼 수 있는 신뢰 지표 페이지.
 * =========================================================================
 * 사용자 요청 그대로 구현한 화면:
 *   "모든 과정이 투명해야 믿을 수 있다" → 정산(SETTLED) 완료된 거래는 예외 없이
 *   전부(=별도 등록 절차 없이 자동으로) 여기 나타난다. 의뢰인/전문가가 "이 건은
 *   비공개로 해달라"고 고를 수 없다 - 그래야 이 목록이 편집되지 않은 전수라는
 *   신뢰가 생긴다.
 *   "시스템 점수와 의뢰인 점수를 같이 주자, 합치지 말고" → 두 점수를 한 줄로
 *   합산하지 않고 카드 안에서 물리적으로 나눠(파란 블록 / 남색 블록) 보여준다.
 *   "익명화로 하자" → 실명/정확한 금액/프로젝트 제목은 절대 내려오지 않는다
 *   (백엔드 BountiesService.listPublicCases 참고) - 화면에서도 그 값들을
 *   보여줄 방법이 아예 없다(애초에 응답에 없으니까).
 * =========================================================================
 */

// 프로젝트 목록 화면과 같은 A/B/C 분류지만, 이 화면은 "사례 카드"라 왼쪽 띠가 아니라
// 상단 라벨 색으로 표현한다 - 같은 목적(분야 구분)이라도 표현 방식 자체를 다르게 가져가
// "카드 표현뿐인 복붙"이 되지 않게 한다.
const CATEGORY_BY_DOMAIN: Record<DomainType, 'A' | 'B' | 'C'> = {
  BACKEND_DB_TUNING: 'A',
  WEB3_SECURITY_AUDIT: 'A',
  DEV_CODE_REVIEW: 'A',
  CRAWLING_ARCHITECTURE: 'A',
  MOBILE_QA_AUTOMATION: 'A',
  TECH_CREATOR_CONSULTING: 'B',
  AUDIO_MASTERING_REVIEW: 'B',
  INDIE_GAME_QA: 'B',
  GRAPHICS_3D_OPTIMIZATION: 'B',
  VEHICLE_DIAGNOSTICS: 'B',
  BUILDING_DEFECT_INSPECTION: 'B',
  FIRE_SAFETY_INSPECTION: 'B',
  STARTUP_CONTRACT_REVIEW: 'C',
  TAX_STRUCTURE_FACTCHECK: 'C',
  REAL_ESTATE_TITLE_ANALYSIS: 'C',
};

const CATEGORY_LABEL_CLASS: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-tint-clay text-brand-clay',
  B: 'bg-tint-gold text-brand-gold',
  C: 'bg-tint-sage text-brand-sage',
};

export default function PublicCasesPage() {
  const [cases, setCases] = useState<PublicBountyCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<PublicBountyCase[]>('/cases')
      .then((res) => setCases(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-tint-ink text-brand-ink">
          <ScrollText size={20} />
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink-900">공개 거래 사례</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            정산이 끝난 거래는 예외 없이 여기에 자동으로 공개돼요. 의뢰인·전문가 실명과
            정확한 금액은 익명화되지만, 처리 기간·점수는 그대로 보여드려요.
          </p>
        </div>
      </div>

      <JangdanDivider />

      {loading && (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-4xl bg-surface-raised" />
          ))}
        </div>
      )}

      {!loading && cases.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-4xl border border-dashed border-hairline-strong bg-surface-canvas py-16 text-center">
          <ScrollText size={28} className="text-ink-400" />
          <p className="text-sm text-ink-500">아직 정산 완료된 거래 사례가 없어요.</p>
        </div>
      )}

      {!loading && cases.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {cases.map((c, i) => {
            const category = CATEGORY_BY_DOMAIN[c.domainType];
            return (
              <div
                key={c.id}
                style={jangdanDelay(i)}
                className="animate-stagger-in flex flex-col gap-4 rounded-3xl border border-hairline bg-surface-canvas p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CATEGORY_LABEL_CLASS[category]}`}
                  >
                    {c.domainLabel}
                  </span>
                  <span className="text-xs font-medium text-ink-400">{c.expertHandle}</span>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-700">
                  <span>
                    처리 기간 <b className="font-display text-ink-900">{c.durationDays}</b>일
                  </span>
                  <span>
                    거래 금액 <b className="font-display text-ink-900">{c.amountBand}</b>
                  </span>
                </div>

                {/* 시스템 점수와 의뢰인 점수는 절대 합치지 않고 나란히 분리해서 보여준다
                    (사용자 지시: "시스템 점수와 의뢰인 점수를 같이 주는거지") */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-tint-sage px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-sage">
                      <Gauge size={13} /> 시스템 점수
                    </div>
                    <p className="mt-0.5 font-display text-xl tracking-wide text-brand-sage">
                      {c.systemScore.toFixed(1)}
                      <span className="text-xs font-sans font-medium text-brand-sage/70"> / 10</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-brand-sage/70">완료율·분쟁승률·처리속도 자동 계산</p>
                  </div>
                  <div className="rounded-2xl bg-tint-ink px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-ink">
                      <UserCheck size={13} /> 의뢰인 점수
                    </div>
                    {c.clientRating !== null ? (
                      <p className="mt-0.5 font-display text-xl tracking-wide text-brand-ink">
                        {c.clientRating.toFixed(1)}
                        <span className="text-xs font-sans font-medium text-brand-ink/70"> / 10</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-brand-ink/60">아직 평가 전</p>
                    )}
                    <p className="mt-0.5 text-[10px] text-brand-ink/70">거래해본 의뢰인의 직접 평가</p>
                  </div>
                </div>

                {c.clientRatingNote && (
                  <p className="line-clamp-2 rounded-xl bg-surface-raised px-3 py-2 text-xs text-ink-600">
                    “{c.clientRatingNote}”
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
