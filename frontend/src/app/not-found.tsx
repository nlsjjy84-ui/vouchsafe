import Link from 'next/link';
import { Compass } from 'lucide-react';

/**
 * 한글 404 페이지 (2026-10-28 추가)
 * - Next.js 기본 not-found는 영어("This page could not be found")라, 앱 전체(한글)와
 *   어긋나 보였다. 사용자가 잘못된/삭제된 주소로 왔을 때도 같은 말투로 안내하고
 *   홈으로 돌아갈 길을 준다.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Compass size={40} className="text-brand-sage" aria-hidden />
      <p className="font-display text-5xl text-ink-900">404</p>
      <h1 className="text-lg font-semibold text-ink-900">찾는 페이지가 없어요</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-500">
        주소가 바뀌었거나 이미 끝난 거래일 수 있어요. 아래에서 다시 시작해 보세요.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-brand-sage px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          첫 화면으로
        </Link>
        <Link
          href="/bounties"
          className="rounded-full border border-hairline-strong px-6 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-surface-raised"
        >
          프로젝트 둘러보기
        </Link>
      </div>
    </main>
  );
}
