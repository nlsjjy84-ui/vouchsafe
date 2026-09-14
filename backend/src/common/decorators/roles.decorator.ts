import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

/**
 * NestJS의 "메타데이터" 기능을 이용한 역할 기반 접근 제어(RBAC) 데코레이터.
 *
 * 사용법: 컨트롤러 메서드 위에 @Roles(UserRole.ADMIN) 을 붙이면,
 * "이 API는 ADMIN 역할만 호출 가능"이라는 표시(메타데이터)가 그 메서드에 붙는다.
 * 이 표시 자체는 아무것도 막지 않는다 — 실제로 막는 건 RolesGuard(roles.guard.ts)다.
 * @Roles는 "표지판"이고, RolesGuard는 "표지판을 읽고 실제로 문을 잠그는 경비원"이라고
 * 생각하면 된다.
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
