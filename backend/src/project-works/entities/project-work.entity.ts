import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { ProjectBudgetItem } from '../../projects/entities/project-budget-item.entity';
import { User } from '../../users/entities/user.entity';
import { WorkPaymentType, WorkStatus } from '../../common/enums';

// A one-off paid task a project publishes (logo, business plan, sourcing, ...).
// Funded from the stage (budget item) it belongs to; paid from the project's
// spendable balance, reserved into escrow when an applicant is selected.
@Entity('project_works')
export class ProjectWork {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => ProjectBudgetItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'budget_item_id' })
  budgetItem: ProjectBudgetItem | null;

  @Column({ type: 'varchar', nullable: true, name: 'budget_item_id' })
  budgetItemId: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  brief: string;

  @Column('decimal', { precision: 14, scale: 2 })
  price: string;

  @Column({ type: 'enum', enum: WorkPaymentType, default: WorkPaymentType.CASH })
  paymentType: WorkPaymentType;

  @Column({ default: false, name: 'allow_counter_offers' })
  allowCounterOffers: boolean;

  // Extra % a worker gets for taking the reward as tickets (invest credit)
  // instead of cash — the carrot that keeps value inside the project.
  @Column('decimal', { precision: 5, scale: 2, default: 0, name: 'ticket_premium_percent' })
  ticketPremiumPercent: string;

  // How the selected worker is paid, locked in when they're chosen.
  @Column({ type: 'enum', enum: WorkPaymentType, nullable: true, name: 'assignee_payment' })
  assigneePayment: WorkPaymentType | null;

  @Column({ type: 'enum', enum: WorkStatus, default: WorkStatus.OPEN })
  status: WorkStatus;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee: User | null;

  @Column({ type: 'varchar', nullable: true, name: 'assignee_id' })
  assigneeId: string | null;

  // Amount frozen from the project's spendable balance while the work is in
  // progress; released to the worker on acceptance, refunded on cancel.
  @Column('decimal', { precision: 14, scale: 2, nullable: true, name: 'escrow_amount' })
  escrowAmount: string | null;

  @Column({ type: 'date', nullable: true })
  deadline: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'accepted_at' })
  acceptedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
