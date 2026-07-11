import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { FinancialReportStatus } from '../../common/enums';

@Entity('project_financial_reports')
@Index(['projectId', 'period'], { unique: true })
export class ProjectFinancialReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'enum', enum: FinancialReportStatus, default: FinancialReportStatus.PUBLISHED })
  status: FinancialReportStatus;

  // Totals are frozen at publish time so later bookkeeping edits can never
  // silently change an already-published report.
  @Column('decimal', { precision: 14, scale: 2, default: 0, name: 'income_total' })
  incomeTotal: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0, name: 'expenses_total' })
  expensesTotal: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0, name: 'net_profit' })
  netProfit: string;

  @Column('decimal', { precision: 14, scale: 2, nullable: true, name: 'payout_total' })
  payoutTotal: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'published_at' })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'paid_at' })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
