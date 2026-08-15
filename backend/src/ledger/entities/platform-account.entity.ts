import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * The platform's own money — the pool every reward, streak bonus, draw prize and
 * referral bonus is paid out of.
 *
 * Until now this was the wallet of whichever admin account happened to be
 * created first: `findOne({ where: { role: ADMIN }, order: { createdAt: 'ASC' } })`.
 * That made the marketing budget indistinguishable from one person's spending
 * money — the same balance could buy tickets — and tied every reward on the
 * platform to an account that can be banned, soft-deleted or demoted, at which
 * point payouts stop with nothing on screen to say why.
 *
 * A single row, pinned to a fixed id, so "the platform's balance" is one place
 * that can be locked FOR UPDATE like any other account rather than a query that
 * might return a different row tomorrow.
 */
@Entity('platform_account')
export class PlatformAccount {
  // Fixed rather than generated: there is exactly one of these, and a generated
  // id would let a second row exist without anything complaining.
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  balance: string;

  @Column({ default: 'AMD' })
  currency: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** The one row's id. See the note on the entity. */
export const PLATFORM_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';
