import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// One row per user per day they opened the app. The streak — the thing that both
// pays the "7 days in a row" reward and qualifies a referral without a deposit —
// is counted off these rows, so it can't be faked by a single call: it needs
// seven distinct calendar days. The unique pair makes a day idempotent.
@Entity('daily_checkins')
@Index(['userId', 'checkinDate'], { unique: true })
export class DailyCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The relation is what makes `user_id` a uuid with a foreign key rather than a
  // bare string: without it TypeORM infers `character varying` and emits no
  // constraint, which let check-ins outlive the user they belong to. Since the
  // streak is counted off these rows, an orphan is not dead weight — it keeps
  // qualifying a referral for somebody who no longer exists.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // The calendar day, stored as YYYY-MM-DD so consecutive-day arithmetic is a
  // plain date comparison and never trips over time-of-day.
  @Column({ type: 'date', name: 'checkin_date' })
  checkinDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
