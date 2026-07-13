import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { ProjectBudgetItem } from '../../projects/entities/project-budget-item.entity';
import { FundReleaseStatus } from '../../common/enums';

// A founder's request to release one funding stage (budget item) from the
// project treasury into the spendable balance. A moderator approves or rejects.
@Entity('fund_release_requests')
export class FundReleaseRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => ProjectBudgetItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_item_id' })
  budgetItem: ProjectBudgetItem;

  @Column({ name: 'budget_item_id' })
  budgetItemId: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: FundReleaseStatus, default: FundReleaseStatus.PENDING })
  status: FundReleaseStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'text', nullable: true, name: 'decision_note' })
  decisionNote: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'decided_by_id' })
  decidedById: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'decided_at' })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
