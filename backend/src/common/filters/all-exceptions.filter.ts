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

/** Postgres 22P02 = invalid_text_representation. 대표 사례: uuid 컬럼에 "abc" 같은 잘못된 형식이 들어옴 */
const POSTGRES_INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * 전역 예외 처리 필터.
 *
 * 이 필터가 없으면 두 가지 문제가 있었다:
 * 1) 컨트롤러/서비스 어디선가 던진 순수 Error나 TypeORM의 QueryFailedError가
 *    Nest 기본 핸들러를 타면서 스택 트레이스가 그대로 응답 바디에 노출될 위험이 있다.
 * 2) `GET /api/bounties/not-a-uuid` 처럼 uuid 컬럼에 잘못된 형식의 값이 들어오면
 *    TypeORM이 Postgres 22P02 에러를 던지는데, 이게 그대로 500으로 나가버린다 —
 *    사실은 클라이언트가 잘못된 요청을 보낸 것(400)인데 서버 탓으로 보이는 셈.
 *
 * 이 필터는 (1) HttpException은 원래 상태코드/메시지를 그대로 유지하고,
 * (2) 22P02는 400으로 변환하고, (3) 그 외 예상치 못한 에러는 로그를 남기고
 * 500 + 안전한 일반 메시지로만 응답해서 내부 구현 세부사항이 새어나가지 않게 한다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    if (this.isInvalidTextRepresentation(exception)) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: '요청 값의 형식이 올바르지 않습니다',
        error: 'Bad Request',
      });
      return;
    }

    if (exception instanceof QueryFailedError) {
      this.logger.error(
        `DB 쿼리 실패: ${request.method} ${request.url} — ${exception.message}`,
        exception.stack,
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '서버 내부 오류가 발생했습니다',
      });
      return;
    }

    const err = exception as Error;
    this.logger.error(
      `처리되지 않은 예외: ${request.method} ${request.url} — ${err?.message}`,
      err?.stack,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '서버 내부 오류가 발생했습니다',
    });
  }

  private isInvalidTextRepresentation(exception: unknown): boolean {
    if (!(exception instanceof QueryFailedError)) return false;
    const driverError = (exception as QueryFailedError & { driverError?: { code?: string } })
      .driverError;
    return driverError?.code === POSTGRES_INVALID_TEXT_REPRESENTATION;
  }
}
