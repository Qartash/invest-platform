import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProjectWork } from './project-work.entity';
import { MilestoneStatus } from '../../common/enums';

// Optional breakdown of a large work into separately-paid stages. Each is
// submitted and accepted on its own; accepting one pays its slice of escrow.
@Entity('work_milestones')
export class WorkMilestone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProjectWork, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_id' })
  work: ProjectWork;

  @Column({ name: 'work_id' })
  workId: string;

  @Column({ type: 'text' })
  title: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column('int')
  order: number;

  @Column({ type: 'enum', enum: MilestoneStatus, default: MilestoneStatus.PENDING })
  status: MilestoneStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
