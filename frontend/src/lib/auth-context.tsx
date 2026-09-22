'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import { User } from './types';

/**
 * =========================================================================
 * AuthContext — "지금 누가 로그인해 있는가"를 앱 전체에서 공유하는 저장소
 * =========================================================================
 * React Context: 페이지마다 로그인 정보를 새로 물어보지 않고, 최상위(layout.tsx)에서
 * 한 번 감싸두면 하위의 모든 화면이 useAuth() 훅으로 바로 꺼내 쓸 수 있게 해주는 기능.
 *
 * 토큰은 브라우저의 localStorage에 저장한다 - 새로고침해도 로그인이 유지되게 하기 위함.
 * =========================================================================
 */

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // [보안 강화] 가입 직후 자동 로그인이 사라지면서 반환 타입도 바뀌었다 - 더 이상
  // accessToken/user를 안 돌려주고, "인증 메일을 보냈다"는 메시지만 돌려준다.
  // register 화면은 이 값으로 "메일함을 확인해주세요" 안내를 보여준다.
  register: (
    email: string,
    password: string,
    name: string,
    role: User['role'],
    phoneNumber?: string,
  ) => Promise<{ email: string; message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱이 처음 뜰 때, 저장해둔 토큰이 있으면 그걸로 "내 정보"를 다시 확인한다.
  useEffect(() => {
    const saved = window.localStorage.getItem('vouchsafe_token');
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    api
      .get('/auth/me')
      .then((res) => setUser({ id: res.data.userId, email: res.data.email, role: res.data.role }))
      .catch(() => {
        // 토큰이 만료됐거나 유효하지 않으면 로그아웃 처리
        window.localStorage.removeItem('vouchsafe_token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function applyAuthResult(data: { accessToken: string; user: User }) {
    window.localStorage.setItem('vouchsafe_token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    applyAuthResult(res.data);
  }

  // [보안 강화] 예전에는 가입 성공 응답이 로그인 응답과 같은 모양(accessToken +
  // user)이라 applyAuthResult로 바로 로그인 처리했다. 이제 백엔드가 가입 시점에
  // 토큰을 안 주므로(이메일 인증 전 로그인 차단 - auth.service.ts 참고), 여기서도
  // 로그인 상태를 만들지 않고 서버가 돌려준 { email, message }를 그대로 반환만
  // 한다 - 실제 화면 처리(안내 문구 표시 등)는 호출한 쪽(register 페이지)의 몫.
  async function register(
    email: string,
    password: string,
    name: string,
    role: User['role'],
    phoneNumber?: string,
  ): Promise<{ email: string; message: string }> {
    const res = await api.post('/auth/register', { email, password, name, role, phoneNumber });
    return res.data;
  }

  // [보안 강화] 예전에는 로컬(localStorage)에 저장된 토큰만 지웠는데, 그러면
  // 그 토큰 자체는 서버에서 만료 시간(24h)까지 여전히 유효한 채로 남아있었다
  // (브라우저에서만 "안 쓰는" 것일 뿐, 그 값을 누가 그대로 들고 있으면 계속
  // 쓸 수 있었다는 뜻). 이제는 로컬을 지우기 전에 서버 쪽 세션도 먼저
  // 무효화(POST /auth/logout)한다 - backend AuthSession 참고. 서버 호출이
  // 실패해도(예: 이미 만료된 토큰으로 로그아웃을 두 번 누른 경우) 로컬 상태는
  // 반드시 지워서 사용자가 "로그아웃이 안 눌린다"고 느끼는 일이 없게 한다.
  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // 서버 세션 무효화가 실패해도 로컬 로그아웃은 그대로 진행한다.
    } finally {
      window.localStorage.removeItem('vouchsafe_token');
      setToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 아무 화면에서나 const { user, login, logout } = useAuth(); 로 꺼내 쓴다 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다');
  return ctx;
}
