import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** @UseGuards(JwtAuthGuard) 로 컨트롤러/라우트에 붙이면 로그인한 사용자만 접근 가능 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
