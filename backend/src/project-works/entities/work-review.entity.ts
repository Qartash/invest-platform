import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProjectWork } from './project-work.entity';
import { User } from '../../users/entities/user.entity';

// A founder's rating of the worker after a work is accepted. One per work.
@Entity('work_reviews')
@Index(['workId'], { unique: true })
export class WorkReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProjectWork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id' })
  work: ProjectWork;

  @Column({ name: 'work_id' })
  workId: string;

  @Column({ name: 'reviewee_id' })
  revieweeId: string;

  @Column({ name: 'rater_id' })
  raterId: string;

  @Column('int')
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
