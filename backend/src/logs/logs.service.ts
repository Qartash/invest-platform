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
    const safeMetadata = metadata ? JSON.parse(JSON.stringify(metadata, jsonReplacer)) : null;
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
