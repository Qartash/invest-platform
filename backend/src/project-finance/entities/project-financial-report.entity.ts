import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity('project_financial_reports')
@Index(['projectId', 'period'], { unique: true })
export class ProjectFinancialReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
