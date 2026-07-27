import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PartnerApplicationStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';

// Someone with an audience asking to be paid for bringing investors in. It is
// reviewed by a person rather than approved automatically, because the platform
// answers for what a partner says about it — the promise of a return made in
// someone else's video is still the platform's problem.
@Entity('partner_applications')
export class PartnerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  // Where the audience is: a channel, a site, a newsletter.
  @Column({ type: 'varchar', name: 'channel_type' })
  channelType: string;

  @Column({ type: 'varchar', name: 'channel_url' })
  channelUrl: string;

  @Column({ type: 'int', name: 'audience_size' })
  audienceSize: number;

  @Column({ type: 'text' })
  topic: string;

  // How they intend to talk about the platform. The single most useful field in
  // the form: it is where a reviewer sees, before any money is at stake, whether
  // this person is about to sell a guaranteed return.
  @Column({ type: 'text' })
  plan: string;

  @Column({ type: 'enum', enum: PartnerApplicationStatus, default: PartnerApplicationStatus.PENDING })
  status: PartnerApplicationStatus;

  @Column({ type: 'text', nullable: true, name: 'reviewer_note' })
  reviewerNote: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by_id' })
  reviewedById: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
