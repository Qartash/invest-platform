import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

/**
 * A post from a founder to the people who put money in.
 *
 * Two things write here. A founder writing one by hand, and the platform posting
 * one itself when a financial report is published — `auto` tells them apart.
 * The automatic ones are the reason the feed is not empty in month two: the
 * reporting flow already exists and already produces the only news an investor
 * reliably wants, so it posts itself rather than waiting for someone to
 * remember.
 */
@Entity('project_updates')
@Index('IDX_project_updates_project_created', ['projectId', 'createdAt'])
export class ProjectUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  // Null for the posts the platform writes itself.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'author_id' })
  authorId: string | null;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  // Uploaded image URLs, in display order. A plain array rather than a table:
  // they are only ever read and written together with the post.
  @Column({ type: 'jsonb', nullable: true })
  photos: string[] | null;

  @Column({ default: false })
  auto: boolean;

  // For an automatic post, what produced it — a report id, so the app can link
  // straight through to the figures rather than repeating them in prose.
  @Column({ type: 'jsonb', nullable: true, name: 'auto_payload' })
  autoPayload: Record<string, unknown> | null;

  @Column('int', { default: 0, name: 'helpful_count' })
  helpfulCount: number;

  // How many holders opened it. Shown to the founder as "read by 68 of 94",
  // which is the only feedback they get that anyone is listening.
  @Column('int', { default: 0, name: 'read_count' })
  readCount: number;

  // A post can be corrected for an hour and then stands. Same reasoning as an
  // answer, one step softer: a typo in a headline sent to 94 people is worth
  // fixing, a rewrite of what you told them last month is not.
  @Column({ type: 'timestamptz', nullable: true, name: 'edited_at' })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'hidden_reason' })
  hiddenReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'hidden_by_user_id' })
  hiddenByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
