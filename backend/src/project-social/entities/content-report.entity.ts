import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ContentReportStatus, ContentTarget } from '../../common/enums';

/**
 * Somebody flagging a question, an answer or an update for a moderator.
 *
 * One row per reporter per target — the unique index — so the count on the
 * moderator's queue is "three different people objected", not "one person
 * tapped three times". Reports are kept after they are dealt with: a founder
 * whose answers get reported every month is a pattern, and a table that deletes
 * the resolved ones cannot show it.
 */
@Entity('content_reports')
@Index('UQ_content_reports_reporter_target', ['reporterId', 'targetType', 'targetId'], {
  unique: true,
})
@Index('IDX_content_reports_status_created', ['status', 'createdAt'])
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'reporter_id' })
  reporterId: string | null;

  @Column({ type: 'varchar', name: 'target_type' })
  targetType: ContentTarget;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId: string;

  // Which project the reported thing belongs to. Denormalised so the queue can
  // be grouped and filtered without walking answer → question → project.
  @Column({ type: 'uuid', nullable: true, name: 'project_id' })
  projectId: string | null;

  // A short code from a fixed list (`off_platform`, `contacts`, `spam`,
  // `not_an_answer`, `other`) plus the reporter's own words, if any. The code is
  // what the moderator filters on; the text is what explains the odd case.
  @Column({ type: 'varchar' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', default: ContentReportStatus.PENDING })
  status: ContentReportStatus;

  @Column({ type: 'uuid', nullable: true, name: 'resolved_by_user_id' })
  resolvedByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
