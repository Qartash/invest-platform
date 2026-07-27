import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import type { NextFunction, Request, Response } from 'express';

/**
 * Neon suspends a free-tier compute after five minutes of quiet, and the request unlucky
 * enough to arrive next pays half a second to two seconds waking it back up. That wait is
 * spread randomly across whoever happens to be using the app, which is why the same screen
 * sometimes opens instantly and sometimes seems broken.
 *
 * The obvious fix — ping forever — is the wrong one. The free plan bills compute *hours*,
 * roughly 190 a month, and a compute held open around the clock burns 730 of them and takes
 * the database offline for the rest of the month. So the ping follows people rather than the
 * clock: while anyone is using the app it keeps the compute awake, and once the app has been
 * quiet for half an hour it stops and lets the database sleep. The next visitor after a long
 * silence still pays the wake-up once — that one is not worth a month of billed hours.
 */

// Neon's idle timeout is five minutes; four leaves room for a late or skipped tick.
const PING_CRON = '0 */4 * * * *';

// How long after the last request the app still counts as in use. Long enough to cover
// someone reading a project page before tapping through to the next one.
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  // Starts in the past deliberately: a server that has just booted and served nobody has no
  // reason to hold a database open.
  private lastRequestAt = 0;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  markActivity(): void {
    this.lastRequestAt = Date.now();
  }

  @Cron(PING_CRON)
  async ping(): Promise<void> {
    if (Date.now() - this.lastRequestAt > ACTIVE_WINDOW_MS) return;

    try {
      await this.dataSource.query('SELECT 1');
    } catch (err) {
      // A failed ping is not an incident of its own — the next real request will report the
      // outage properly, and retrying here would only add noise to the logs.
      this.logger.warn(`Keep-alive ping failed: ${(err as Error).message}`);
    }
  }
}

/**
 * Marks every incoming request as activity. Deliberately counts all of them, including the
 * ones that never touch the database: what matters is whether someone is around, not what
 * they asked for.
 */
@Injectable()
export class KeepAliveMiddleware implements NestMiddleware {
  constructor(private readonly keepAlive: KeepAliveService) {}

  use(_req: Request, _res: Response, next: NextFunction): void {
    this.keepAlive.markActivity();
    next();
  }
}
