import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'CredoBounty',
  description: '검증된 전문가와 의뢰인을 잇는 고관여 전문 결과물 에스크로 거래 플랫폼',
};

// 모든 페이지를 감싸는 최상위 레이아웃.
// AuthProvider로 감싸둬야 그 아래 어떤 페이지에서도 useAuth()를 쓸 수 있다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
