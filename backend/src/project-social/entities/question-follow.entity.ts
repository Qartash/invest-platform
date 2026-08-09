import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Who wants to hear about a thread.
 *
 * Everyone who writes in one is subscribed automatically — the asker when they
 * ask, anyone adding a follow-up when they add it — and the switch on the thread
 * screen is what lets them out again. That is why this is a row rather than a
 * derived "everybody who ever posted here": an implicit rule has no way to say
 * no, and a thread that keeps notifying somebody who asked it to stop is how
 * people turn notifications off entirely.
 *
 * A founder is not subscribed to their own project's threads through this table.
 * They already get QUESTION_ASKED for every question, and following as well
 * would tell them twice about the same thing.
 */
@Entity('question_follows')
@Index('UQ_question_follows_user_question', ['userId', 'questionId'], { unique: true })
@Index('IDX_question_follows_question', ['questionId'])
export class QuestionFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
