import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Quest } from './quest.entity';
import { User } from '../../users/entities/user.entity';

// One person finishing one quest. The unique pair is what makes a quest pay once:
// a double-tap, a replayed request or a second device all collide on it rather
// than minting a second reward.
@Entity('quest_completions')
@Index(['userId', 'questId'], { unique: true })
export class QuestCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Quest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quest_id' })
  quest: Quest;

  @Column({ name: 'quest_id' })
  questId: string;

  // What was actually credited, which can differ from the quest's reward if the
  // pool was short or a moderator awarded a partial bug bounty.
  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
