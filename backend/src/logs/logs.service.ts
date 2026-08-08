import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemLog } from './entities/system-log.entity';
import { LogSettings } from './entities/log-settings.entity';
import { LogLevel, LogSource } from '../common/enums';
import { setDbLogWriter } from './db-query-logger';
import { setConsoleLogWriter } from './console-log-bridge';

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

@Injectable()
export class LogsService implements OnModuleInit {
  // Cached in memory so the hot path (logging itself) never blocks on a DB round trip;
  // refreshed synchronously whenever an admin updates settings.
  private settings: LogSettings = {
    id: SETTINGS_ID,
    frontendClicksEnabled: true,
    backendRequestsEnabled: true,
    errorsEnabled: true,
    databaseQueriesEnabled: false,
    consoleLogsEnabled: true,
    updatedAt: new Date(),
  };

  constructor(
    @InjectRepository(SystemLog) private readonly logsRepository: Repository<SystemLog>,
    @InjectRepository(LogSettings) private readonly settingsRepository: Repository<LogSettings>,
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
