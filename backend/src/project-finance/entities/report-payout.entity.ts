import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProjectFinancialReport } from './project-financial-report.entity';
import { User } from '../../users/entities/user.entity';

// Snapshot of who held how many tickets when a report's dividends were paid,
// and how much each holder received. Immutable payout evidence.
@Entity('report_payouts')
@Index(['reportId', 'userId'], { unique: true })
export class ReportPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProjectFinancialReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ProjectFinancialReport;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column('int')
  tickets: number;

  @Column('decimal', { precision: 7, scale: 4, name: 'share_percent' })
  sharePercent: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
