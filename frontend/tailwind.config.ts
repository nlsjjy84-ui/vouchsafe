import type { Config } from 'tailwindcss';

/**
 * 기획서 표지/본문에서 쓰인 색상 팔레트(brand.*)에 더해, 2026-09 UI 리뉴얼 때
 * 국내 핀테크(토스/카카오뱅크)와 Linear/Stripe 계열 대시보드 디자인 리서치를 참고해
 * "표면(surface) 3단 레이어 + 중립(ink) 텍스트 스케일 + 옅은 상태색(soft-tint)" 토큰을
 * 추가했다. brand.* 색은 CTA/활성 상태 등 "포인트"에만 쓰고, 배경/구분선/본문 텍스트는
 * 아래 surface/ink/border 토큰을 쓰는 게 원칙 (리서치 결과: 포인트 컬러를 아끼는 것이
 * "차분한 신뢰감"을 주는 핵심 트릭).
 *
 * 2026-09-16 팔레트 리터치: "기본색이 너무 흔하다"는 피드백에 실제로 원인이 있었다 -
 * 기존 brand.teal(#14b8a6)/tealDeep(#0d9488)은 Tailwind 기본 팔레트의 teal-500/600을
 * 손도 안 대고 그대로 쓰고 있었다(그래서 "어디서 많이 본 색"처럼 느껴진 것). 1차
 * 수정(#1c8f82)은 그냥 살짝 어둡게만 한 거라 "달라졌다"고 할 수 없다는 재지적을 받고,
 * 훨씬 더 짙고 채도 높은 "깊은 비취/spruce" 톤(#0a6e5c)으로 다시 조색했다 - 스포이드로
 * 찍어도 Tailwind 기본 팔레트 어디에도 없는 값이고, 밝기 자체가 원래보다 눈에 띄게
 * 어두워서 "정말 바뀌었다"가 한눈에 보인다. 토큰 이름(brand.teal)은 유지해서 이 색을
 * 쓰는 기존 클래스(bg-brand-teal 등)가 전부 자동으로 새 색을 받는다.
 * 그리고 "버튼마다 색이 다 똑같다"는 지적은 색상 자체보다 "모든 버튼이 brand.teal
 * 하나만 쓰고 있었다"는 사용 편중 문제였다 - components/Button.tsx가 이미 있던
 * blue/amber/navy/red 톤을 버튼 역할별로 나눠 쓰도록 하는 게 진짜 해법이라 그 쪽도
 * 같이 손봤다(components/Button.tsx 참고). 색 역할 정리:
 *   teal  = 화면당 단 하나의 핵심 액션 (로그인/지원하기/제출/승인)
 *   blue  = AI 기능 · 선택/결정 액션
 *   amber = 결제 등 돈이 오가거나 주의가 필요한 지점
 *   navy  = 구조적 요소(헤더/사이드바) + 보조 유틸리티 액션
 *   red   = 위험 · 경고 · 이의제기
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#0a6e5c',
          tealDeep: '#054a3d',
          navy: '#0f172a',
          navyLight: '#1e2b4d',
          amber: '#c2760c',
          blue: '#3b6fc9',
          red: '#b3413e',
        },
        surface: {
          canvas: '#ffffff',
          DEFAULT: '#f7f8f9',
          raised: '#eef1f4',
        },
        ink: {
          900: '#0f172a',
          700: '#334155',
          500: '#64748b',
          400: '#94a3b8',
        },
        hairline: {
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
        },
        tint: {
          teal: '#e6f7f5',
          amber: '#fdf1e2',
          blue: '#e9eefb',
          red: '#fbeceb',
          navy: '#eaecf1',
        },
      },
      boxShadow: {
        float: '0 12px 24px -8px rgba(15, 23, 42, 0.18)',
      },
      fontFamily: {
        /*
         * 타이포그래피 시스템(2026-09 재수정): "글꼴도 그렇고 강조도... 뭔가 변화가
         * 없자나"라는 피드백에 대한 직접적인 답. sans(본문)를 시스템 기본값에서
         * Gothic A1로 바꿔 전체 화면의 "손질된 느낌"을 올리고, display(헤드라인/큰
         * 숫자 전용)는 Do Hyeon으로 완전히 다른 성격의 서체를 써서 "여기는 강조 지점"
         * 이라는 신호를 글꼴 자체로 준다 - 배민 브랜드 서체처럼 특정 접점에만 한정.
         */
        sans: ['"Gothic A1"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        display: ['"Do Hyeon"', 'sans-serif'],
        serifAccent: ['"Gowun Batang"', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
