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
          타이포그래피 시스템: next/font/google 대신 <link> 태그로 직접 로드한다 -
          빌드 타임에 폰트 파일을 원격에서 받아와야 하는 next/font 의존성을 피하고,
          런타임에 브라우저가 알아서 받아오게 해서 이 프로젝트의 오프라인/샌드박스
          빌드 환경에서도 항상 안전하게 빌드되도록 하기 위함이다.

          - Do Hyeon: 헤드라인/큰 숫자 전용 디스플레이 폰트(font-display 유틸).
            굵은 붓글씨 느낌이 살짝 남은 고딕체라 자간을 넓혀 쓰면 "브랜드 로고체"
            처럼 보이면서도 유치해 보이지 않는다 (배민 브랜드 서체가 "특정 접점에만
            한정해서 쓰는" 원칙을 따른 것 - 본문에는 절대 안 쓴다).
          - Gothic A1: 본문/UI 기본 서체(font-sans, tailwind 기본값 교체). 시스템
            기본 고딕(맑은 고딕)보다 자간/획 디자인이 정제되어 있어서, 같은
            레이아웃이어도 "손질된 느낌"을 준다.
          - Gowun Batang: 감성 헤드라인/에디토리얼 강조 전용 세리프(font-serif-accent
            유틸). "폰트도 계속 같은 느낌"이라는 피드백에 대한 답 - Do Hyeon(고딕
            디스플레이)과 완전히 다른 결의 서체를 한 지점 더 추가해서, 화면마다
            쓰는 강조 서체 자체를 다르게 가져갈 수 있게 함.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Gothic+A1:wght@400;500;600;700;800;900&family=Gowun+Batang:wght@400;700&display=swap"
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
