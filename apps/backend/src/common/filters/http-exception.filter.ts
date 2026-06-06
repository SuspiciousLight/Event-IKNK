import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-error.interface';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithUser>();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
        ? (exceptionResponse as { message?: string | string[] }).message ?? 'Unexpected error'
        : exception instanceof Error
          ? exception.message
          : 'Unexpected error';

    const payload: ApiErrorResponse = {
      code: this.getCode(exception, status),
      message,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    };

    this.logger.error(
      JSON.stringify({
        requestId: request.requestId,
        path: request.originalUrl || request.url,
        status,
        code: payload.code,
      }),
    );

    response.status(status).json(payload);
  }

  private getCode(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'code' in res) {
        return String((res as { code: unknown }).code);
      }
    }

    return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
  }
}