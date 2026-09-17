import type { Config } from 'tailwindcss';

/**
 * =========================================================================
 * 팔레트/서체/형태 전면 재설계 (2026-09-17)
 * =========================================================================
 * 배경: concept-b(teal/네이비 + 각진 스캘럽)에 대한 피드백 이후 concept-c
 * (클레이/잉크/세이지 + 세리프 + 원형·블롭)를 별도 비교용 페이지(/concept-c)로
 * 만들어놓고 "형태만 c로, 색상은 b(기존 teal/navy)로 유지"라는 절충안으로
 * 덮어버렸었다(components/Decor.tsx 옛 주석 참고). 그 절충 자체가 문제였다 -
 * 화면에서 가장 먼저, 가장 강하게 인식되는 건 형태가 아니라 색인데, 색을 그대로
 * 두고 장식 모양만 바꿔서는 "여전히 어디서 본 듯한 청록/네이비 SaaS"라는 인상이
 * 바뀔 수 없었다. 팔레트를 1차(#14b8a6 그대로), 2차(#1c8f82로 살짝 어둡게)로
 * 두 번 땜질했다가 "달라진 게 없다"는 재지적을 받은 이력도 있다(git blame 참고).
 *
 * 이번엔 절충 없이 concept-c 쪽으로 완전히 넘어간다 - 색(clay/ink/sage/gold +
 * 종이 질감의 warm ivory 배경)과 서체(세리프 헤드라인)를 모두 교체한다. 토큰
 * 이름 자체도 teal/navy/amber/blue가 아니라 실제 색의 정체성을 그대로 부르는
 * 이름(clay/ink/sage/gold)으로 바꿔서, 다음에 또 "값만 슬쩍 바꾸는" 땜질을
 * 하기 어렵게 만들었다 - 이름을 바꾸면 코드 전체에서 그 색을 쓰는 자리가
 * 전부 드러나기 때문에, 이번 변경이 코드베이스 전역에 실제로 적용됐다는 걸
 * grep 한 번으로 확인할 수 있다.
 *
 * 색 역할 정리 (기존 teal/blue/amber/navy/red 자리를 그대로 대체):
 *   clay(테라코타/적) = 화면당 단 하나의 핵심 액션 (구 teal)
 *   sage(청록빛 자연)  = AI 기능 · 선택/결정 액션 (구 blue)
 *   gold(황토)         = 결제 등 돈이 오가거나 주의가 필요한 지점 (구 amber)
 *   ink(먹)            = 구조적 요소(헤더/사이드바) + 보조 유틸리티 액션 (구 navy)
 *   red                = 위험 · 경고 · 이의제기 (그대로 유지 - clay와 색상환에서
 *                        떨어뜨려 둬서 "브랜드 강조색"과 "진짜 위험 신호"가
 *                        섞이지 않게 함)
 *
 * 오방색(청/적/황/백/흑)과의 대응: ink=흑, clay=적, gold=황, surface(paper)=백,
 * sage=청(자연/생명 쪽으로 해석) - 사물놀이/국악 배경을 색상 서사로 가져왔다.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          clay: '#c2410c',
          clayDeep: '#9a3412',
          ink: '#241a14',
          inkLight: '#4a3626',
          gold: '#b8801f',
          sage: '#5b6b4f',
          red: '#a3312c',
        },
        surface: {
          canvas: '#fffdf8',
          DEFAULT: '#f7f1e8',
          raised: '#efe3d1',
        },
        ink: {
          900: '#241a14',
          700: '#4a3d33',
          500: '#7a6a5c',
          400: '#a89686',
        },
        hairline: {
          DEFAULT: '#e4d9c8',
          strong: '#d3c3ac',
        },
        tint: {
          clay: '#f7e2d3',
          gold: '#faecd0',
          sage: '#e6ebe0',
          red: '#f4dedd',
          ink: '#ece6dd',
        },
      },
      borderRadius: {
        /*
         * "네모(카드 모서리)가 다 똑같아 보인다"는 지적의 실제 원인은 반경 값이
         * 아니라 반경 "규칙이 하나뿐"이라는 거였다 - 지금은 두 축으로 나눴다:
         *   rounded-full  : 상호작용 요소(버튼/배지/아바타/네비 pill) - 완전한 원
         *   rounded-none  : 의도적으로 각지게 남겨둘 유틸리티 요소
         *   rounded-4xl   : 카드/패널 전용 - concept-c의 28px 카드 반경으로 통일
         * 이 두 축이 한 화면 안에 같이 있는 것 자체가 "규칙이 하나가 아니다"는
         * 신호가 되도록 했다(예: 각진 pill 버튼 + 큰 카드 + 완전한 원형 로고칩).
         */
        '4xl': '28px',
        '3xl': '22px',
        '2xl': '18px',
      },
      boxShadow: {
        float: '0 12px 24px -8px rgba(36, 26, 20, 0.18)',
        bloom: '0 20px 45px -15px rgba(36, 26, 20, 0.35)',
      },
      fontFamily: {
        /*
         * "폰트도 그렇고... 반복되는 습관을 깨라"는 지적에 대한 답. Gothic A1은
         * 이미 주석에 "부트캠프/포폴에서 자주 보이는 흔한 조합"이라고 스스로
         * 적어놨던 서체이고, Do Hyeon도 마찬가지로 흔한 라운드 고딕 디스플레이라
         * 둘 다 완전히 걷어냈다.
         *   sans(본문)    : IBM Plex Sans KR - 기술/금융 서비스 느낌의 각진
         *     그로테스크. 국내 부트캠프 포폴에서 거의 안 쓰는 조합이라 눈에 띈다.
         *   display(헤드라인) : Gowun Batang(세리프)을 "포인트"가 아니라 전체
         *     헤드라인의 기본값으로 승격 - 고딕 일색이던 화면에 세리프 헤드라인은
         *     그 자체로 "다른 축"이다. font-display를 쓰는 자리(로고/헤드라인/
         *     큰 숫자)가 전부 자동으로 세리프로 바뀐다.
         *   serifAccent   : display와 같은 서체를 유지 - 기존에 이미 이 이름으로
         *     쓰이던 자리(감성 카피, concept-c 유산)가 자연스럽게 이어지도록.
         */
        sans: ['"IBM Plex Sans KR"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        display: ['"Gowun Batang"', 'Georgia', 'serif'],
        serifAccent: ['"Gowun Batang"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
