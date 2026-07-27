import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { invalidateCached } from './response-cache';

/**
 * Retires the cached project list whenever something that could change it succeeds.
 *
 * The list is assembled from a project's own row plus counts of tickets and works, so it
 * moves for a great many reasons: an approval, an edit, a purchase, a resale listing, a new
 * work posted. Rather than remembering to invalidate at each of those call sites — a list
 * that would quietly fall out of date as new endpoints appear — this watches the routes that
 * own that data and clears the cache when a write against one of them returns successfully.
 *
 * Deliberately blunt: it costs at most one extra rebuild of a list that takes three queries,
 * and being blunt is what makes it correct by default. A failed write leaves the cache alone,
 * since nothing changed.
 */

// Route prefixes (after the global /api prefix) whose writes can move the project list.
const WATCHED_PREFIXES = ['/api/projects', '/api/tickets', '/api/project-works', '/api/project-funding'];

@Injectable()
export class ProjectCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const isWrite = request.method !== 'GET' && request.method !== 'HEAD';
    const touchesProjects = WATCHED_PREFIXES.some((prefix) => request.path.startsWith(prefix));

    if (!isWrite || !touchesProjects) return next.handle();

    return next.handle().pipe(tap(() => invalidateCached('projects')));
  }
}
