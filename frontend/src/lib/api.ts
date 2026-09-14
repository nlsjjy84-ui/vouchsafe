import axios from 'axios';

/**
 * 백엔드와 통신하는 axios 인스턴스.
 * baseURL을 '/api'로 두면 next.config.js의 rewrites 설정이 실제 백엔드(8080번 포트)로
 * 요청을 대신 전달해준다 - 프론트 코드에서는 백엔드 주소를 몰라도 된다.
 */
export const api = axios.create({ baseURL: '/api' });

// 로그인 토큰이 있으면 모든 요청에 자동으로 Authorization 헤더를 붙여준다.
// (매번 요청마다 헤더를 직접 챙기지 않아도 되게 하는 axios의 "인터셉터" 기능)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('credobounty_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/** 서버가 에러를 내려줬을 때 메시지만 뽑아내는 헬퍼 (화면에 그대로 보여주기 위함) */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (data?.message) return data.message;
  }
  return '알 수 없는 오류가 발생했습니다';
}

/**
 * 서버가 던진 에러가 특정 "식별 코드"를 가진 에러인지 확인한다.
 * 백엔드가 일부 에러에서 응답의 error 필드를 표준 상태 문구("Forbidden" 등)
 * 대신 EMAIL_NOT_VERIFIED 같은 식별 가능한 값으로 채워 보내는 경우가 있는데
 * (AllExceptionsFilter가 그 값을 그대로 실어준다), 단순히 메시지 문자열을
 * 파싱하는 것보다 이렇게 명시적인 코드로 분기하는 편이 문구가 바뀌어도
 * 안 깨져서 더 안전하다.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  if (!axios.isAxiosError(error)) return false;
  const data = error.response?.data as { error?: string } | undefined;
  return data?.error === code;
}
