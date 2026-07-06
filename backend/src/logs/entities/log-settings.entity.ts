import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Single-row table: there is always exactly one settings record, at id = 1.
@Entity('log_settings')
export class LogSettings {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ default: true, name: 'frontend_clicks_enabled' })
  frontendClicksEnabled: boolean;

  @Column({ default: true, name: 'backend_requests_enabled' })
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
