import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 로그인하지 않아도 통과시키되, 토큰이 있으면 request.user를 채워 준다.
 * 공개 게시판에서 "내가 좋아요 눌렀는지"를 로그인한 사람에게만 알려 주기 위한 용도.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: unknown, user: any) {
    return user || null;
  }
}
