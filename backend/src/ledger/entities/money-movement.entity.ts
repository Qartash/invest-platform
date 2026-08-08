import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { LedgerAccount, MovementKind } from '../../common/enums';

/**
 * One movement of money, with both ends named.
 *
 * This exists because `transactions` cannot answer where money came from: it
 * carries a single `user_id` and no counterparty, so the founder's wallet
 * quietly dropping by the size of a dividend run looked identical to it dropping
 * for no reason — and six movements (stage releases, founder withdrawals,
 * refunds, work escrow in and out, the founder's side of a payout) left no row
 * at all. A project has no user id, so it could never appear there even in
 * principle.
 *
 * Deliberately a second table rather than columns bolted onto `transactions`.
 * That one is the user's own operations history — paged, totalled and shown in
 * the wallet — and half of what belongs here has no user to show it to. Keeping
 * them apart means the ledger can record a treasury-to-spendable release without
 * inventing a person it happened to.
 *
 * Rows are written inside the same database transaction as the balance change
 * they describe, so a movement can never be recorded for money that did not
 * move, nor money move without a movement.
 *
 * No foreign keys to users or projects: this is an audit trail, and a deleted
 * account must not take the record of its money with it.
 */
@Entity('money_movements')
// The panel's default view is "everything, newest first", and every filter on it
// narrows that same order.
@Index('IDX_movements_created', ['createdAt'])
@Index('IDX_movements_kind_created', ['kind', 'createdAt'])
@Index('IDX_movements_from_user', ['fromUserId'])
@Index('IDX_movements_to_user', ['toUserId'])
@Index('IDX_movements_from_project', ['fromProjectId'])
@Index('IDX_movements_to_project', ['toProjectId'])
export class MoneyMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MovementKind, enumName: 'movement_kind_enum' })
  kind: MovementKind;

  // Always positive. Direction is carried by the two account ends, not by a
  // sign — a negative amount here would mean the same movement could be written
  // two ways round and the totals would depend on which one a caller picked.
  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column({ default: 'AMD' })
  currency: string;

  // Both ends share one Postgres type rather than taking TypeORM's default of a
  // separate `{table}_{column}_enum` each. With two types, "movements touching the
  // outside world" — `from_account = $1 OR to_account = $1` — cannot be asked at
  // all: Postgres refuses to compare the two, since a parameter can only be one
  // of them.
  @Column({ type: 'enum', enum: LedgerAccount, enumName: 'ledger_account_enum', name: 'from_account' })
  fromAccount: LedgerAccount;

  @Column({ type: 'uuid', nullable: true, name: 'from_user_id' })
  fromUserId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'from_project_id' })
  fromProjectId: string | null;

  @Column({ type: 'enum', enum: LedgerAccount, enumName: 'ledger_account_enum', name: 'to_account' })
  toAccount: LedgerAccount;

  @Column({ type: 'uuid', nullable: true, name: 'to_user_id' })
  toUserId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'to_project_id' })
  toProjectId: string | null;

  // Set on the three movements that belong to one job, so a work's money can be
  // followed from the moment it was frozen to the moment it was paid or given back.
  @Column({ type: 'uuid', nullable: true, name: 'work_id' })
  workId: string | null;

  // The user-facing wallet row this movement produced, where there is one. Null
  // for the movements no user sees — a stage release, an escrow hold.
  @Column({ type: 'uuid', nullable: true, name: 'transaction_id' })
  transactionId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
