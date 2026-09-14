import { redirect } from 'next/navigation';

// 루트 주소('/')로 들어오면 바운티 목록 화면으로 바로 보낸다.
export default function HomePage() {
  redirect('/bounties');
}
