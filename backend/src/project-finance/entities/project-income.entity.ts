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

  // Soft delete: the entry stays in the books as history for everyone to see.
  @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'deleted_reason' })
  deletedReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
