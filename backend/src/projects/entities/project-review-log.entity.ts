import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProjectReviewAction } from '../../common/enums';
import { Project } from './project.entity';

@Entity('project_review_logs')
export class ProjectReviewLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'enum', enum: ProjectReviewAction })
  action: ProjectReviewAction;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'moderator_id' })
  moderatorId: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'moderator_name' })
  moderatorName: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
