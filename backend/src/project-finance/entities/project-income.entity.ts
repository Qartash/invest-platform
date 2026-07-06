import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity('project_incomes')
export class ProjectIncome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date' })
  date: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
