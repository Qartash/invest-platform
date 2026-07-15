import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransactionAccount, TransactionStatus, TransactionType } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @ManyToOne(() => Ticket, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket | null;

  @Column({ name: 'ticket_id', nullable: true })
  ticketId: string | null;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column('int', { nullable: true })
  quantity: number | null;

  // Human-readable context, e.g. the title of the work this payment was for.
  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Which wallet balance this affected (cash vs invest-credit). Null for older
  // rows and transactions where it doesn't apply.
  @Column({ type: 'enum', enum: TransactionAccount, nullable: true })
  account: TransactionAccount | null;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
