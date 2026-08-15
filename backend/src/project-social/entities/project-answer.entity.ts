import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProjectQuestion } from './project-question.entity';
import { User } from '../../users/entities/user.entity';

/**
 * A reply under a question. Two kinds live in this table and `fromFounder` is
 * what tells them apart: the founder's answer, and anyone else's follow-up.
 *
 * There is no update endpoint on purpose. An answer is a promise made to people
 * who put money in, and a promise that can be quietly rewritten afterwards is
 * not one — a founder who wants to correct themselves posts another answer, and
 * both stay visible in order. For the same reason there is no delete: only a
 * moderator can take one out of view, and even that only hides it.
 */
@Entity('project_answers')
@Index('IDX_project_answers_question_created', ['questionId', 'createdAt'])
export class ProjectAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProjectQuestion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: ProjectQuestion;

  @Column({ name: 'question_id' })
  questionId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'author_id' })
  authorId: string | null;

  @Column({ type: 'text' })
  body: string;

  // Frozen at write time rather than derived from the project's current founder:
  // a project can change hands, and an answer given by the founder of the day
  // was the founder's answer whatever happens later.
  @Column({ default: false, name: 'from_founder' })
  fromFounder: boolean;

  // Both denormalised from content_votes, both shown on every answer.
  @Column('int', { default: 0, name: 'helpful_count' })
  helpfulCount: number;

  // The count that makes an evasive answer visible. Nothing is done with it
  // automatically — it is shown next to "helped", and readers draw their own
  // conclusion.
  @Column('int', { default: 0, name: 'not_answer_count' })
  notAnswerCount: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'hidden_at' })
  hiddenAt: Date | null;

  @Column({ type: 'varchar', nullable: true, name: 'hidden_reason' })
  hiddenReason: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'hidden_by_user_id' })
  hiddenByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
