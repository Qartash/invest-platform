import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ContentTarget, ContentVoteKind } from '../../common/enums';

/**
 * One person's one vote of one kind on one thing.
 *
 * The unique index is the whole point of the table. Counters on the question and
 * the answer are what the screens read; this row is what stops the same person
 * adding to them twice. Without it a vote counter is a number anyone can type
 * into by tapping repeatedly, and a sort order built on it means nothing.
 */
@Entity('content_votes')
@Index('UQ_content_votes_voter_target_kind', ['userId', 'targetType', 'targetId', 'kind'], {
  unique: true,
})
// The read that renders a screen is "which of these did I already vote on",
// asked for one user across a page of targets.
@Index('IDX_content_votes_target', ['targetType', 'targetId'])
export class ContentVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'target_type' })
  targetType: ContentTarget;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId: string;

  @Column({ type: 'varchar' })
  kind: ContentVoteKind;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
