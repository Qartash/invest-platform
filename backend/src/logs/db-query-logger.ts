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

/**
 * What is left of a query's parameters once they are no longer worth stealing.
 *
 * The parameters are the values themselves: the INSERT that creates an account carries the
 * bcrypt hash, the email and the person's name; every lookup by email carries the email.
 * All of it was being written verbatim into `system_logs` — a table with no expiry, read
 * back through an admin screen and included in any dump of the database. That is a second
 * copy of the credential store, kept somewhere nobody thinks of as one.
 *
 * The queries themselves stay: they are the reason this logger exists. Only the values go,
 * replaced by their type and length, which is what you actually read them for when chasing
 * a slow query — whether the parameter was there and roughly how big it was.
 */
function redact(parameters?: unknown[]): string[] | undefined {
  if (!parameters) return undefined;
  return parameters.slice(0, 20).map((value) => {
    if (value === null || value === undefined) return String(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return `date(${value.toISOString()})`;
    if (typeof value === 'string') return `string(${value.length})`;
    if (Array.isArray(value)) return `array(${value.length})`;
    return typeof value;
  });
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
    writer('info', 'Database query', { query: truncate(query), parameters: redact(parameters) });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    if (!writer || mentionsExcludedTable(query)) return;
    writer('error', 'Database query error', {
      query: truncate(query),
      parameters: redact(parameters),
      error: error instanceof Error ? error.message : error,
    });
  }

  logQuerySlow(time: number, query: string, parameters?: any[], _queryRunner?: QueryRunner): void {
    if (!writer || mentionsExcludedTable(query)) return;
    writer('warn', 'Slow database query', { durationMs: time, query: truncate(query), parameters: redact(parameters) });
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
