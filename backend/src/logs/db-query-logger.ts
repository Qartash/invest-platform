import { Logger as TypeOrmLoggerInterface, QueryRunner } from 'typeorm';

// Tables that must never be logged here — writing a log row triggers an INSERT that would
// otherwise get logged too, recursing forever. Matched by literal table name in the SQL text.
const EXCLUDED_TABLES = ['system_logs', 'log_settings'];
const MAX_TEXT_LENGTH = 2000;

function truncate(value: string): string {
  return value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}…` : value;
}

function mentionsExcludedTable(sql: string): boolean {
  return EXCLUDED_TABLES.some((table) => sql.includes(table));
}

export type DbLogWriter = (level: 'info' | 'warn' | 'error', message: string, metadata: Record<string, any>) => void;

// Set once by LogsModule at startup. The TypeORM `logger` option is constructed before Nest's
// DI container exists, so this module-level bridge is how DbQueryLogger reaches LogsService
// without a circular dependency between TypeOrmModule and LogsModule.
let writer: DbLogWriter | null = null;

export function setDbLogWriter(fn: DbLogWriter): void {
  writer = fn;
}

export class DbQueryLogger implements TypeOrmLoggerInterface {
  logQuery(query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    if (!writer || mentionsExcludedTable(query)) return;
    writer('info', 'Database query', { query: truncate(query), parameters: parameters?.slice(0, 20) });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    if (!writer || mentionsExcludedTable(query)) return;
    writer('error', 'Database query error', {
      query: truncate(query),
      parameters: parameters?.slice(0, 20),
      error: error instanceof Error ? error.message : error,
    });
  }

  logQuerySlow(time: number, query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    if (!writer || mentionsExcludedTable(query)) return;
    writer('warn', 'Slow database query', { durationMs: time, query: truncate(query), parameters: parameters?.slice(0, 20) });
  }

  logSchemaBuild(message: string): void {
    if (!writer) return;
    writer('info', 'Schema build', { message: truncate(message) });
  }

  logMigration(message: string): void {
    if (!writer) return;
    writer('info', 'Migration', { message: truncate(message) });
  }

  log(level: 'log' | 'info' | 'warn', message: any): void {
    if (!writer) return;
    writer(level === 'warn' ? 'warn' : 'info', 'TypeORM log', { message: truncate(String(message)) });
  }
}
