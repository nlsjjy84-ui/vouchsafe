import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { STATUS_CODES } from 'http';

/**
 * =========================================================================
 * AllExceptionsFilter — 앱 전체에서 터지는 모든 예외를 한 곳에서 받아
 * "일관된 모양의 에러 응답"으로 바꿔주는 최종 안전망
 * =========================================================================
 * 이게 왜 필요한가?
 *   지금까지는 각 서비스에서 NotFoundException, BadRequestException처럼
 *   "예상한" 에러는 잘 처리하고 있었다. 문제는 "예상하지 못한" 에러다 —
 *   예를 들어 URL에 `/bounties/이상한값` 처럼 UUID가 아닌 문자열을 넣으면,
 *   TypeORM/PostgreSQL이 "이 값은 uuid 형식이 아니다"라는 에러(QueryFailedError)를
 *   던지는데, 이걸 아무도 안 잡으면 Nest가 기본으로 500 Internal Server Error +
 *   의미 없는 메시지를 그대로 응답으로 내보낸다. 사용자 입장에서는 "그냥 서버가
 *   고장났다"로만 보이고, 원인(내가 URL을 잘못 만들었다)을 전혀 알 수 없다.
 *
 * 이 필터가 하는 일:
 *  1) 이미 의도적으로 던진 에러(HttpException: NotFoundException, 400 등)는
 *     그대로 존중해서 그 상태코드/메시지를 응답한다.
 *  2) "잘못된 형식의 값을 DB에 물어봐서" 나는 에러(QueryFailedError, PostgreSQL
 *     에러코드 22P02 = invalid_text_representation)는 400 Bad Request로 바꿔서
 *     "요청 형식이 잘못됐다"는 것을 명확히 알려준다.
 *  3) 그 외 진짜로 예상 못한 에러는, 서버 로그에는 원인(스택 트레이스)을 전부
 *     남기되, 사용자에게는 내부 구조가 드러나지 않는 일반적인 메시지만 500으로
 *     응답한다 (에러 메시지에 파일 경로나 SQL 쿼리가 그대로 노출되면 보안 문제가 될
 *     수 있기 때문).
 *
 * 응답 형태를 항상 { statusCode, error, message, path, timestamp }로 통일해서,
 * 프론트엔드가 "에러 응답은 항상 이 모양이다"라고 믿고 처리할 수 있게 한다.
 * =========================================================================
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message } = this.resolve(exception);

    if (status >= 500) {
      // 500번대(진짜 예상 못한 에러)는 서버 콘솔에 스택 트레이스까지 전부 남긴다.
      // 이래야 나중에 실제로 어디서 문제가 생겼는지 추적할 수 있다.
      this.logger.error(
        `[${request.method} ${request.url}] ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): { status: number; error: string; message: string | string[] } {
    // 1) 이미 NestJS 방식으로 의도적으로 던진 에러 (NotFoundException, BadRequestException 등)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // STATUS_CODES[401] === 'Unauthorized', STATUS_CODES[403] === 'Forbidden' 처럼
      // "표준 상태코드 이름"을 Node 내장 상수에서 가져온다. exception.name(예:
      // "UnauthorizedException")을 그대로 쓰면 다른 곳(400 Bad Request, 404 Not Found
      // 등)과 표기가 안 맞아서, 항상 이 표준 이름으로 통일한다.
      const standardPhrase = STATUS_CODES[status] ?? 'Error';
      if (typeof body === 'string') {
        return { status, error: standardPhrase, message: body };
      }
      const bodyObj = body as { error?: string; message?: string | string[] };
      return {
        status,
        error: bodyObj.error ?? standardPhrase,
        message: bodyObj.message ?? exception.message,
      };
    }

    // 2) DB에 "형식이 잘못된 값"을 물어봐서 난 에러 (예: UUID 자리에 이상한 문자열)
    //    PostgreSQL 에러코드 22P02 = invalid_text_representation
    if (exception instanceof QueryFailedError) {
      const driverError = (exception as QueryFailedError & { code?: string }).code;
      if (driverError === '22P02') {
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: '요청 형식이 올바르지 않습니다 (예: 잘못된 ID 형식).',
        };
      }
    }

    // 3) 나머지는 전부 "진짜 예상 못한 에러" → 내부 구조를 숨기고 일반 메시지만 응답
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    };
  }
}
