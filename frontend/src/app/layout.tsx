import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'CredoBounty',
  description: '검증된 전문가와 의뢰인을 잇는 고관여 전문 결과물 에스크로 거래 플랫폼',
};

// 모든 페이지를 감싸는 최상위 레이아웃.
// AuthProvider로 감싸둬야 그 아래 어떤 페이지에서도 useAuth()를 쓸 수 있다.
// 실제 레이아웃(로그인 전 Navbar / 로그인 후 Sidebar+Topbar)은 AppShell이 로그인
// 여부를 보고 갈라준다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/*
          타이포그래피 시스템 전면 교체 (2026-09-17): Do Hyeon + Gothic A1 조합을
          완전히 걷어냈다 - 이전 주석에도 "부트캠프/포폴에서 흔히 보이는 조합"이라고
          스스로 적어놨던 그 서체들이다. next/font/google 대신 <link> 태그로 직접
          로드하는 방식은 그대로 유지한다 (빌드 타임에 폰트 파일을 원격에서 받아와야
          하는 next/font 의존성을 피하고, 오프라인/샌드박스 빌드 환경에서도 항상
          안전하게 빌드되도록 하기 위함 - 이건 서체 선택과 무관한 인프라 결정이라
          바꿀 이유가 없었다).

          - IBM Plex Sans KR: 본문/UI 기본 서체(font-sans). 국내 부트캠프 포폴에서
            거의 안 쓰는, 기술/금융 서비스 느낌의 그로테스크 - Gothic A1 자리를
            대체.
          - Gowun Batang: 이전엔 "가끔 쓰는 감성 강조용 세리프"(font-serif-accent)
            였던 걸, 이번엔 헤드라인 전체의 기본값(font-display)으로 승격시켰다.
            고딕 일색이던 화면에서 세리프 헤드라인은 그 자체로 "다른 축"이 된다 -
            색만 바꾸는 게 아니라 화면의 성격 자체가 달라 보이게 하는 핵심 장치.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Gowun+Batang:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
