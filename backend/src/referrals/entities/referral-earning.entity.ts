import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EarningChannel, ReferralEarningStatus, ReferralEarningType } from '../../common/enums';
import { User } from '../../users/entities/user.entity';

// One accrual to one beneficiary, traceable to the invitee whose action earned
// it. Every payout is a row here first, so the invest-credit balance can always
// be reconstructed from — and reconciled against — this ledger.
@Entity('referral_earnings')
export class ReferralEarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Who earns this — an ancestor somewhere up the invitee's chain.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiary_id' })
  beneficiary: User;

  @Index()
  @Column({ name: 'beneficiary_id' })
  beneficiaryId: string;

  // The invitee whose qualifying action triggered this earning. Masked before it
  // ever reaches the beneficiary's screen.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_user_id' })
  sourceUser: User;

  @Index()
  @Column({ name: 'source_user_id' })
  sourceUserId: string;

  // The invitee's depth below the beneficiary: 1 for a direct invitee. Drives the
  // ladder amount and is kept for auditing.
  @Column('int')
  level: number;

  @Column({ type: 'enum', enum: ReferralEarningType })
  type: ReferralEarningType;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: ReferralEarningStatus, default: ReferralEarningStatus.PENDING })
  status: ReferralEarningStatus;

  // Invest credit for ordinary users, card for partners. The payout job only ever
  // moves the invest ones; card earnings mature and then wait for the monthly
  // invoice, so real money never leaves on a schedule nobody looked at.
  @Column({ type: 'enum', enum: EarningChannel, default: EarningChannel.INVEST })
  channel: EarningChannel;

  // When the hold ends and the earning may be paid. Read by the maturation job.
  @Column({ type: 'timestamptz', name: 'matures_at' })
  maturesAt: Date;

  // The deposit transaction that triggered this, when there was one — the anchor
  // for voiding the earning if that deposit is later refunded.
  @Column({ type: 'uuid', nullable: true, name: 'trigger_transaction_id' })
  triggerTransactionId: string | null;

  // Set when status becomes PAID: the transaction crediting the beneficiary's
  // invest credit. Closes the loop between this ledger and the wallet.
  @Column({ type: 'uuid', nullable: true, name: 'payout_transaction_id' })
  payoutTransactionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
