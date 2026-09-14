import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 컨트롤러에서 @CurrentUser() 로 JWT payload({ userId, email, role })를 바로 받는다 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
