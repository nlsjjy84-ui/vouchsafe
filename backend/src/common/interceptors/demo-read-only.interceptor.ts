import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { isDemoEmail } from '../../modules/auth/auth.service';

/**
 * 공용 데모 계정(@demo.com)은 둘러보기 전용이다 — 면접관·방문자가 화면과 AI 기능은 다 써 보되,
 * 프로젝트 등록·지원·결제·커뮤니티 글처럼 남는 기록은 만들지 못하게 한다(데모 화면이 지저분해지지 않게).
 * 인터셉터는 가드(JwtAuthGuard) 다음에 돌기 때문에, 로그인한 요청이면 req.user가 이미 채워져 있다.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isAllowedForDemo(method: string, path: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  if (path === '/api/auth/logout' || path === '/api/auth/logout-all' || path === '/api/auth/demo') return true;
  // AI 초안·점검은 결과를 돌려주기만 한다(요구사항 확정 저장은 PUT이라 막힌다).
  if (method === 'POST' && path.startsWith('/api/ai/')) return true;
  // 알림 읽음 표시는 화면 상태만 바꾼다.
  if (method === 'PATCH' && path.startsWith('/api/notifications/')) return true;
  return false;
}

@Injectable()
export class DemoReadOnlyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 시연 글을 다시 채울 때처럼 잠깐 풀어야 하면 DEMO_READ_ONLY=off
    const off = (process.env.DEMO_READ_ONLY ?? '').trim().toLowerCase();
    if (off === 'off' || off === 'false' || off === '0') return next.handle();
    const req = context.switchToHttp().getRequest();
    const email: string | undefined = req?.user?.email;
    if (req && isDemoEmail(email)) {
      const path = String(req.originalUrl ?? req.url ?? '').split('?')[0];
      if (!isAllowedForDemo(String(req.method).toUpperCase(), path)) {
        throw new ForbiddenException({
          statusCode: 403,
          errorCode: 'DEMO_READ_ONLY',
          message: '데모 계정은 둘러보기 전용이라 저장·등록은 되지 않아요. AI 초안과 위험 신호 점검은 그대로 써 볼 수 있어요.',
        });
      }
    }
    return next.handle();
  }
}
