import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { DemoReadOnlyInterceptor, isAllowedForDemo } from './demo-read-only.interceptor';

function ctx(method: string, url: string, email?: string) {
  const req = { method, originalUrl: url, user: email ? { email } : undefined };
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}
const next = { handle: () => of('ok') };

describe('DemoReadOnlyInterceptor', () => {
  const it2 = new DemoReadOnlyInterceptor();

  it('데모 계정은 읽기와 AI 초안·점검은 된다', () => {
    expect(isAllowedForDemo('GET', '/api/bounties')).toBe(true);
    expect(isAllowedForDemo('POST', '/api/ai/bounty-draft')).toBe(true);
    expect(isAllowedForDemo('POST', '/api/ai/risk-check')).toBe(true);
    expect(isAllowedForDemo('POST', '/api/auth/logout')).toBe(true);
    expect(isAllowedForDemo('PATCH', '/api/notifications/read-all')).toBe(true);
  });

  it('데모 계정은 등록·지원·글쓰기·요구사항 확정을 못 한다', () => {
    expect(() => it2.intercept(ctx('POST', '/api/bounties', 'client@demo.com'), next)).toThrow(ForbiddenException);
    expect(() => it2.intercept(ctx('POST', '/api/community/posts', 'expert@demo.com'), next)).toThrow(ForbiddenException);
    expect(() => it2.intercept(ctx('PUT', '/api/ai/bounties/1/requirements', 'client@demo.com'), next)).toThrow(ForbiddenException);
    expect(() => it2.intercept(ctx('PATCH', '/api/users/me/budget?x=1', 'client@demo.com'), next)).toThrow(ForbiddenException);
  });

  it('일반 사용자와 비로그인 요청은 그대로 통과한다', () => {
    expect(() => it2.intercept(ctx('POST', '/api/bounties', 'someone@gmail.com'), next)).not.toThrow();
    expect(() => it2.intercept(ctx('POST', '/api/auth/login'), next)).not.toThrow();
  });
});
