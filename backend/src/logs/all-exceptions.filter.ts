import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { LogsService } from './logs.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logsService: LogsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    // Only genuine server-side failures (5xx) go to the error log — 4xx like "not found" or
    // validation errors are expected traffic, not something for an admin to be alerted on.
    if (status >= 500) {
      this.logsService.logError(
        'unhandled_exception',
        exception instanceof Error ? exception.message : 'Unknown error',
        {
          method: request?.method,
          path: request?.originalUrl ?? request?.url,
          statusCode: status,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
        request?.user?.id ?? null,
      );
    }

    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
