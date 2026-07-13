import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProjectWork } from './project-work.entity';
import { User } from '../../users/entities/user.entity';
import { WorkApplicationStatus, WorkPaymentType } from '../../common/enums';

@Entity('work_applications')
@Index(['workId', 'applicantId'], { unique: true })
export class WorkApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProjectWork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id' })
  work: ProjectWork;

  @Column({ name: 'work_id' })
  workId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicant_id' })
  applicant: User;

  @Column({ name: 'applicant_id' })
  applicantId: string;

  @Column({ type: 'text', nullable: true, name: 'cover_letter' })
  coverLetter: string | null;

  // Optional counter-offer; when null the work's base price applies.
  @Column('decimal', { precision: 14, scale: 2, nullable: true, name: 'offered_price' })
  offeredPrice: string | null;

  @Column({ type: 'enum', enum: WorkPaymentType, default: WorkPaymentType.CASH, name: 'preferred_payment' })
  preferredPayment: WorkPaymentType;

  @Column({ type: 'enum', enum: WorkApplicationStatus, default: WorkApplicationStatus.PENDING })
  status: WorkApplicationStatus;

  // Founder's reason when rejecting this application, shown to the applicant.
  @Column({ type: 'text', nullable: true, name: 'decision_reason' })
  decisionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
