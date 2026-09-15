import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

/**
 * @Roles(...)가 붙은 라우트에서 request.user.role이 허용 목록에 있는지 검사한다.
 * @Roles가 없는 라우트는 그냥 통과시킨다 (역할 제한이 없다는 뜻이므로) —
 * 이 가드 하나를 전역에 걸어두더라도 @Roles를 명시한 라우트에만 실제로 제한이 걸린다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('이 작업을 수행할 권한이 없습니다');
    }
    return true;
  }
}
