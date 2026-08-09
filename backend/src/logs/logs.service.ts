import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';
import { LogSettings } from './entities/log-settings.entity';
import { LogLevel, LogSource } from '../common/enums';
import { setDbLogWriter } from './db-query-logger';
import { setConsoleLogWriter } from './console-log-bridge';
import { withCronLock } from '../common/cron-lock';

export interface LogFilters {
  source?: LogSource;
  level?: LogLevel;
  category?: string;
  userId?: string;
  search?: string;
}

const SETTINGS_ID = 1;
const MAX_METADATA_LENGTH = 4000;
// Ceilings on the shape of a metadata object, not just on the strings inside it.
const MAX_METADATA_DEPTH = 6;
const MAX_METADATA_ITEMS = 50;
const MAX_METADATA_BYTES = 16_000;

/**
 * How long a log row is worth keeping, by how much it is worth.
 *
 * `system_logs` had no expiry at all, and with request logging on that is one row — carrying
 * the request body as jsonb, across four indexes — for every call the API answers. Nobody
 * deletes them, because the only thing that could was a button in the admin panel that wipes
 * the lot. A table that grows with traffic and never shrinks does not fail politely: it fills
 * the database the rest of the platform is running in, and the first thing anybody notices is
 * that buying a ticket stopped working.
 *
 * Split by level because the levels have genuinely different lifespans. An info row is for
 * watching something happen this week; nobody has ever gone back three months to read a 200.
 * An error is the opposite — the value of keeping it is precisely that it is still there when
 * somebody finally comes asking why.
 */
const RETENTION_DAYS: Readonly<Record<LogLevel, number>> = {
  [LogLevel.DEBUG]: 3,
  [LogLevel.INFO]: 7,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 90,
};

// Deleted in batches rather than as one statement per level. A first purge against a table
// that has been accumulating for months would otherwise be a single DELETE holding locks over
// millions of rows, on a database that is also serving requests.
const PURGE_BATCH_SIZE = 5_000;
const MAX_PURGE_BATCHES = 200;

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);

  // Cached in memory so the hot path (logging itself) never blocks on a DB round trip;
  // refreshed synchronously whenever an admin updates settings.
  private settings: LogSettings = {
    id: SETTINGS_ID,
    frontendClicksEnabled: true,
    // Off unless an admin turns it on. This is the one toggle that writes a row per request,
    // so leaving it on by default meant the platform's busiest table was its log of itself —
    // every purchase paying for two writes, one of them nobody was reading. It stays a toggle
    // rather than being removed: turned on for an afternoon while chasing something, it is
    // exactly the right tool. Left on for a year, it is the thing that fills the database.
    backendRequestsEnabled: false,
    errorsEnabled: true,
    databaseQueriesEnabled: false,
    consoleLogsEnabled: true,
    updatedAt: new Date(),
  };

  constructor(
    @InjectRepository(SystemLog) private readonly logsRepository: Repository<SystemLog>,
    @InjectRepository(LogSettings) private readonly settingsRepository: Repository<LogSettings>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    let settings = await this.settingsRepository.findOne({ where: { id: SETTINGS_ID } });
    if (!settings) {
      settings = await this.settingsRepository.save(this.settingsRepository.create({ id: SETTINGS_ID }));
    }
    this.settings = settings;

    // Bridges the DB query logger (constructed outside Nest's DI, see db-query-logger.ts)
    // back to this service so query logs land in the same system_logs table.
    setDbLogWriter((level, message, metadata) => {
      if (!this.settings.databaseQueriesEnabled) return;
      this.write(LogSource.DATABASE, level === 'error' ? LogLevel.ERROR : level === 'warn' ? LogLevel.WARN : LogLevel.INFO, 'db_query', message, metadata, null);
    });

    // Same bridge pattern for the console patch (see console-log-bridge.ts) — this is what
    // makes anything printed to the server terminal also show up in the Logs screen. Gated by
    // its own consoleLogsEnabled toggle, separate from backendRequestsEnabled, so an admin can
    // watch terminal output without also turning on per-request HTTP logging (or vice versa).
    setConsoleLogWriter((level, message) => {
      if (level === 'error') {
        if (!this.settings.errorsEnabled) return;
        this.write(LogSource.ERROR, LogLevel.ERROR, 'console', message, null, null);
      } else {
        if (!this.settings.consoleLogsEnabled) return;
        this.write(LogSource.BACKEND, level === 'warn' ? LogLevel.WARN : LogLevel.INFO, 'console', message, null, null);
      }
    });

    // Purging on boot as well as on the schedule, for the same reason the draw catches up
    // there: a service that sleeps through the small hours never reaches three in the
    // morning, and a retention policy that only runs at a time the process is never awake
    // is not a retention policy. Not awaited — nothing about starting up depends on it.
    void this.purgeOldLogs().catch((err) => this.logger.error('Log purge on boot failed', err as Error));
  }

  /**
   * Deletes log rows past the retention for their level.
   *
   * Three in the morning to stay clear of the notification purge an hour later — both are
   * large deletes against the same database, and the free tier has little enough headroom
   * without them overlapping.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldLogs(): Promise<void> {
    await withCronLock(this.dataSource, 'logs-purge', async () => {
      let removed = 0;
      for (const [level, days] of Object.entries(RETENTION_DAYS) as Array<[LogLevel, number]>) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        // A bounded delete repeated, rather than one unbounded one. The subquery picks the
        // batch off the (created_at) index; the loop stops as soon as a batch comes back
        // short, which is what tells us the level is clear.
        for (let batch = 0; batch < MAX_PURGE_BATCHES; batch += 1) {
          // RETURNING because the count is the loop's stopping condition and it has to be
          // exact: a DELETE with no RETURNING hands back an empty result through TypeORM's
          // `query`, which would read as "nothing left" after the very first batch.
          // `level::text` because the column is a Postgres enum and a bound parameter
          // arrives as text — comparing the two directly is an error, not a cast.
          const deleted: Array<{ id: string }> = await this.logsRepository.query(
            `DELETE FROM system_logs
              WHERE id IN (
                SELECT id FROM system_logs
                 WHERE created_at < $1 AND level::text = $2
                 LIMIT $3
              )
              RETURNING id`,
            [cutoff.toISOString(), level, PURGE_BATCH_SIZE],
          );
          removed += deleted.length;
          if (deleted.length < PURGE_BATCH_SIZE) break;
        }
      }
      // Logged through Nest's logger rather than this service's own `write`, which would put
      // a row back into the table it has just finished emptying every single night.
      if (removed > 0) this.logger.log(`Purged ${removed} log row(s) past retention`);
    });
  }

  getSettings(): LogSettings {
    return this.settings;
  }

  async updateSettings(partial: Partial<Omit<LogSettings, 'id' | 'updatedAt'>>): Promise<LogSettings> {
    await this.settingsRepository.update({ id: SETTINGS_ID }, partial);
    this.settings = (await this.settingsRepository.findOne({ where: { id: SETTINGS_ID } }))!;
    return this.settings;
  }

  // Fire-and-forget: logging must never throw or slow down the caller's real work.
  // Frontend-originated events share one endpoint (POST /logs/client) but route to different
  // toggles depending on what they actually are: an error is always an error regardless of
  // which console.* call produced it, a browser console.log/warn is gated by its own
  // consoleLogsEnabled switch, and everything else (button clicks, navigation) is gated by
  // frontendClicksEnabled.
  logClient(
    category: string,
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    metadata?: Record<string, any>,
    userId?: string | null,
  ): void {
    if (level === 'error') {
      if (!this.settings.errorsEnabled) return;
      this.write(LogSource.ERROR, LogLevel.ERROR, category, message, metadata, userId ?? null);
      return;
    }
    if (category === 'console') {
      if (!this.settings.consoleLogsEnabled) return;
      this.write(LogSource.FRONTEND, level === 'warn' ? LogLevel.WARN : LogLevel.INFO, category, message, metadata, userId ?? null);
      return;
    }
    if (!this.settings.frontendClicksEnabled) return;
    this.write(LogSource.FRONTEND, LogLevel.INFO, category, message, metadata, userId ?? null);
  }

  logBackendRequest(category: string, message: string, metadata?: Record<string, any>, userId?: string | null): void {
    if (!this.settings.backendRequestsEnabled) return;
    this.write(LogSource.BACKEND, LogLevel.INFO, category, message, metadata, userId ?? null);
  }

  logError(category: string, message: string, metadata?: Record<string, any>, userId?: string | null): void {
    if (!this.settings.errorsEnabled) return;
    this.write(LogSource.ERROR, LogLevel.ERROR, category, message, metadata, userId ?? null);
  }

  private write(
    source: LogSource,
    level: LogLevel,
    category: string,
    message: string,
    metadata?: Record<string, any> | null,
    userId?: string | null,
  ): void {
    const safeMetadata = boundMetadata(metadata);
    const entry = this.logsRepository.create({
      source,
      level,
      category,
      message: message.slice(0, MAX_METADATA_LENGTH),
      metadata: safeMetadata,
      userId: userId ?? null,
    });
    this.logsRepository.insert(entry).catch(() => {
      // Logging must never crash the request that triggered it.
    });
  }

  async findLogs(filters: LogFilters, page: number, pageSize: number): Promise<{ items: SystemLog[]; total: number }> {
    const qb = this.logsRepository.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (filters.source) qb.andWhere('log.source = :source', { source: filters.source });
    if (filters.level) qb.andWhere('log.level = :level', { level: filters.level });
    if (filters.category) qb.andWhere('log.category = :category', { category: filters.category });
    if (filters.userId) qb.andWhere('log.userId = :userId', { userId: filters.userId });
    if (filters.search) qb.andWhere('log.message ILIKE :search', { search: `%${filters.search}%` });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total };
  }

  async clearLogs(): Promise<void> {
    await this.logsRepository.clear();
  }
}

function jsonReplacer(_key: string, value: any) {
  if (typeof value === 'string' && value.length > MAX_METADATA_LENGTH) {
    return `${value.slice(0, MAX_METADATA_LENGTH)}…`;
  }
  return value;
}

/**
 * Metadata as it is safe to store: bounded in depth and in total size.
 *
 * `metadata` on POST /logs/client is an `@IsObject()` and nothing more, so the shape is the
 * caller's to choose. Truncating strings — which is all this did — leaves both the depth and
 * the number of keys unbounded, and a body of a few tens of kilobytes can hold tens of
 * thousands of them: expensive to walk on the way in, stored forever as jsonb, and read back
 * by an admin screen that then has to render it.
 *
 * Depth is cut first, because that is what makes the walk itself cheap, and the result is
 * measured whole: past the ceiling the metadata is dropped for a note saying so, which keeps
 * a log row honest about the fact that something was there.
 */
function boundMetadata(metadata?: Record<string, any> | null): Record<string, any> | null {
  if (!metadata) return null;
  try {
    const pruned = pruneDepth(metadata, MAX_METADATA_DEPTH);
    const serialised = JSON.stringify(pruned, jsonReplacer);
    if (!serialised || serialised.length > MAX_METADATA_BYTES) {
      return { note: 'metadata omitted: too large' };
    }
    return JSON.parse(serialised) as Record<string, any>;
  } catch {
    // Circular, or something that throws from a getter on the way through. Either way it is
    // not worth a row, and logging must never be the thing that fails.
    return { note: 'metadata omitted: not serialisable' };
  }
}

function pruneDepth(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth <= 0) return '[deep]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ITEMS).map((item) => pruneDepth(item, depth - 1));
  }
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_ITEMS);
  return Object.fromEntries(entries.map(([key, item]) => [key, pruneDepth(item, depth - 1)]));
}
