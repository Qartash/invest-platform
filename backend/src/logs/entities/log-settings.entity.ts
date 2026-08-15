import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Single-row table: there is always exactly one settings record, at id = 1.
@Entity('log_settings')
export class LogSettings {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ default: true, name: 'frontend_clicks_enabled' })
  frontendClicksEnabled: boolean;

  // Off unless an admin turns it on: this is the toggle that writes a `system_logs` row per
  // request, body included, so left on it makes the log of the platform the largest thing in
  // the platform. Kept in step with the migration that flipped the column's default — an
  // entity still saying `true` here is not a cosmetic disagreement, because a database built
  // by `synchronize` (a local stand, a test run) takes its default from this line and would
  // quietly start logging everything again.
  @Column({ default: false, name: 'backend_requests_enabled' })
  backendRequestsEnabled: boolean;

  @Column({ default: true, name: 'errors_enabled' })
  errorsEnabled: boolean;

  @Column({ default: false, name: 'database_queries_enabled' })
  databaseQueriesEnabled: boolean;

  @Column({ default: true, name: 'console_logs_enabled' })
  consoleLogsEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
