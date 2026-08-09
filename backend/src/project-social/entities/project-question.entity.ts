import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

/**
 * One question an investor asked a founder, in public.
 *
 * There is no private channel on this platform and there is not meant to be:
 * the value of the whole feature is that the next person to open the project
 * reads the answer without having to ask again. A question is written in
 * whichever language its author uses and stored as it was typed — unlike a
 * project title, nothing here is translated, because a person's own words are
 * not ours to rewrite.
 */
@Entity('project_questions')
// The list screen is always "this project's, newest or most-voted first", and
// the founder's queue is "this project's, still unanswered". Both start here.
@Index('IDX_project_questions_project_created', ['projectId', 'createdAt'])
export class ProjectQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  // The author survives their account being deleted only as a null: the question
  // stays, because the answer under it is part of the project's public record,
  // but it stops carrying a name and the app renders it as a deleted user.
  //
  // The name itself is never copied in here. It is read through this relation
  // every time, so a person who later turns off "show my full name" is masked in
  // questions they asked last year too — a snapshot would freeze the name they
  // had when they were happy to show it.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'author_id' })
  authorId: string | null;

  @Column({ type: 'text' })
  body: string;

  // Denormalised from content_votes. The list sorts on it and every row shows
  // it, so counting votes per question on read would mean one aggregate per
  // screen; the vote service is the only thing that writes it.
  @Column('int', { default: 0, name: 'upvote_count' })
  upvoteCount: number;

  // A founder marking the question everyone actually needs answered. Pinned
  // questions sort above the vote order.
  @Column({ default: false })
  pinned: boolean;

  // Set the first time the founder answers, and never cleared. This is what the
  // responsiveness figures are computed from — see ProjectSocialService — so it
  // deliberately records the *first* answer rather than the latest one.
  @Column({ type: 'timestamptz', nullable: true, name: 'answered_at' })
  answeredAt: Date | null;

  // Hidden, not deleted. A moderator taking a question down leaves the text in
  // place with a reason attached: the author is told why, and "you silently
  // erased my question" stops being a thing anyone can claim.
  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'hidden_reason' })
  hiddenReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'hidden_by_user_id' })
  hiddenByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
