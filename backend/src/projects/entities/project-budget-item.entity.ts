import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';
import { BudgetItemStatus } from '../../common/enums';

@Entity('project_budget_items')
export class ProjectBudgetItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'text' })
  title: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: BudgetItemStatus, default: BudgetItemStatus.NOT_STARTED })
  status: BudgetItemStatus;

  // A budget item doubles as a funding stage: its money is released from the
  // treasury only after a moderator approves a release request for it.
  @Column({ default: false })
  released: boolean;

  @Column('int')
  order: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
