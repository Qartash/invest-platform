import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// One winner of one day's draw. People who arrive on their own — with nobody's
// code — earn nobody a referral bonus; instead the platform puts a fixed sum up
// each day and splits it between users who were active that day. The unique pair
// makes a day's draw impossible to run twice for the same person.
@Entity('daily_draw_awards')
@Index(['userId', 'drawDate'], { unique: true })
export class DailyDrawAward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'date', name: 'draw_date' })
  drawDate: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  // How many people arrived without a code that day — the reason the draw ran,
  // and what the winner is told when the award is shown.
  @Column('int', { name: 'organic_arrivals' })
  organicArrivals: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
