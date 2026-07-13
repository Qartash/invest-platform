import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectPriority, ProjectStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';

export type LocalizedText = Record<string, string>;

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'founder_id' })
  founder: User;

  @Column({ name: 'founder_id' })
  founderId: string;

  @Column({ type: 'jsonb' })
  title: LocalizedText;

  @Column({ type: 'jsonb' })
  description: LocalizedText;

  @Column('decimal', { precision: 14, scale: 2, name: 'target_amount' })
  targetAmount: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0, name: 'collected_amount' })
  collectedAmount: string;

  // Investor money sits in the project treasury (escrow); it moves to
  // spendableBalance only when a moderator approves a stage release.
  @Column('decimal', { precision: 14, scale: 2, default: 0, name: 'treasury_balance' })
  treasuryBalance: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0, name: 'spendable_balance' })
  spendableBalance: string;

  @Column('decimal', { precision: 14, scale: 2, name: 'ticket_price' })
  ticketPrice: string;

  @Column('int', { name: 'total_tickets' })
  totalTickets: number;

  @Column('int', { default: 0, name: 'tickets_sold' })
  ticketsSold: number;

  @Column('int', { default: 4, name: 'price_tier_count' })
  priceTierCount: number;

  @Column('decimal', { precision: 5, scale: 2, default: 20, name: 'price_tier_increment_percent' })
  priceTierIncrementPercent: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.DRAFT })
  status: ProjectStatus;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true, name: 'risk_level' })
  riskLevel: string;

  @Column({ type: 'text', nullable: true, name: 'risk_reason' })
  riskReason: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'risk_set_by_name' })
  riskSetByName: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'risk_set_by_user_id' })
  riskSetByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'risk_set_at' })
  riskSetAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'review_comment' })
  reviewComment: string | null;

  @Column({ type: 'enum', enum: ProjectPriority, default: ProjectPriority.MEDIUM })
  priority: ProjectPriority;

  @Column({ type: 'jsonb', nullable: true, name: 'pending_changes' })
  pendingChanges: Record<string, any> | null;

  @Column({ type: 'text', nullable: true, name: 'pending_change_reason' })
  pendingChangeReason: string | null;

  @Column({ type: 'enum', enum: ProjectStatus, nullable: true, name: 'status_before_review' })
  statusBeforeReview: ProjectStatus | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'deletion_requested_at' })
  deletionRequestedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ nullable: true, name: 'cover_image_url' })
  coverImageUrl: string;

  @Column({ type: 'varchar', nullable: true, name: 'youtube_url' })
  youtubeUrl: string | null;

  @Column({ type: 'date', nullable: true })
  deadline: string | null;

  @Column({ default: false, name: 'resale_enabled' })
  resaleEnabled: boolean;

  @Column('decimal', { precision: 5, scale: 2, default: 20, name: 'expected_annual_return_percent' })
  expectedAnnualReturnPercent: string;

  @Column('int', { default: 30, name: 'payout_start_days' })
  payoutStartDays: number;

  @OneToMany(() => Ticket, (ticket) => ticket.project)
  tickets: Ticket[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
