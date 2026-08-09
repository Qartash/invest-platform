import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One person having seen one post.
 *
 * The row exists so `read_count` counts people rather than page loads. Without
 * it the counter was an increment per request: opening the feed nine times made
 * the top post read "by 9" on a project with two investors, while every post
 * below it stayed at zero because only the first one was ever reported.
 *
 * A founder reads that number to decide whether anyone is listening, so it has
 * to mean what it says. The unique index is what makes it mean it.
 */
@Entity('project_update_reads')
@Index('UQ_project_update_reads_update_user', ['updateId', 'userId'], { unique: true })
export class UpdateRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'update_id' })
  updateId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
