import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * @Roles(UserRole.ADMIN) 처럼 붙여서 RolesGuard가 검사할 허용 역할을 지정한다.
 * 반드시 JwtAuthGuard 뒤에서 동작해야 한다 (request.user가 채워져 있어야 하므로) —
 * 컨트롤러에 @UseGuards(JwtAuthGuard, RolesGuard) 순서로 붙이거나,
 * 클래스 레벨에 JwtAuthGuard를, 메서드 레벨에 RolesGuard를 붙이면 같은 순서로 실행된다.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
