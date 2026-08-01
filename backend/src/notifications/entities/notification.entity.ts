import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationPayload, NotificationType } from '../notification-types';

// One thing that happened, addressed to one person.
//
// The row holds no prose: a type and the figures behind it. The app turns that
// pair into a sentence in the reader's own language — see NotificationType.
@Entity('notifications')
// The list screen reads one user's notifications newest-first, and the bell asks
// for the unread count on top of that. Both are the same prefix, so one index on
// (user, created) serves the list and (user, read_at) serves the badge; without
// them each is a scan of every notification ever sent to anyone.
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
@Index('IDX_notifications_user_read', ['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Deleting an account takes its notifications with it: they are addressed to a
  // person, and are worth nothing once there is nobody to read them.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // varchar, not an enum — see the note on NotificationType.
  @Column({ type: 'varchar' })
  type: NotificationType;

  @Column({ type: 'jsonb', nullable: true })
  payload: NotificationPayload | null;

  // Set by the reader, never by the sender. Null is what the badge counts.
  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt: Date | null;

  // Only meaningful together with (user, type): the repeat-collapsing key
  // described on NotifyInput.
  @Column({ type: 'varchar', nullable: true, name: 'dedupe_key' })
  dedupeKey: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
