import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

/**
 * =========================================================================
 * RolesGuard — "이 요청을 보낸 사람이 이 API를 쓸 자격(역할)이 있는가?"를 확인
 * =========================================================================
 * 반드시 JwtAuthGuard "다음"에 실행되어야 한다. (JwtAuthGuard가 먼저 토큰을
 * 검증해서 request.user를 채워놔야, 이 가드가 그 user.role을 읽을 수 있다.)
 * 그래서 실제 컨트롤러에서는 항상 @UseGuards(JwtAuthGuard, RolesGuard) 순서로 쓴다.
 *
 * 동작 순서:
 * 1) Reflector로 이 요청이 향하는 메서드에 @Roles(...)가 붙어있는지 확인
 * 2) @Roles가 아예 없으면 → 역할 제한이 없는 API라는 뜻이므로 통과
 * 3) @Roles(UserRole.ADMIN)처럼 붙어있으면 → 로그인한 사용자의 role이
 *    그 목록에 포함되는지 확인, 아니면 403 Forbidden으로 차단
 * =========================================================================
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles가 안 붙어있으면 역할 제한이 없는 API → 그냥 통과시킨다.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('이 작업을 수행할 권한이 없습니다 (관리자 전용 기능입니다)');
    }

    return true;
  }
}
