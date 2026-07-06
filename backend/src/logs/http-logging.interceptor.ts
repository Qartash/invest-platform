import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogsService } from './logs.service';

const REDACTED_FIELDS = ['password', 'accessToken', 'token'];

function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone: Record<string, any> = { ...(body as Record<string, any>) };
  for (const field of REDACTED_FIELDS) {
    if (field in clone) clone[field] = '[redacted]';
  }
  return clone;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logsService: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    const userId = request.user?.id ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logsService.logBackendRequest(
            'http_request',
            `${request.method} ${request.originalUrl ?? request.url}`,
            {
              method: request.method,
              path: request.originalUrl ?? request.url,
              statusCode: context.switchToHttp().getResponse().statusCode,
              durationMs: Date.now() - start,
              body: redact(request.body),
            },
            userId,
          );
        },
        error: () => {
          // Failures are captured with full detail by AllExceptionsFilter; still record that
          // the request happened, in case the filter itself is disabled or errors_enabled is off.
          this.logsService.logBackendRequest(
            'http_request',
            `${request.method} ${request.originalUrl ?? request.url}`,
            {
              method: request.method,
              path: request.originalUrl ?? request.url,
              durationMs: Date.now() - start,
              failed: true,
            },
            userId,
          );
        },
      }),
    );
  }
}
