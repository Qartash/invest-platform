import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { ExpenseCategory } from '../../common/enums';

@Entity('project_expenses')
export class ProjectExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column('decimal', { precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.OTHER })
  category: ExpenseCategory;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', nullable: true, name: 'attachment_url' })
  attachmentUrl: string | null;

  // Soft delete: the entry stays in the books as history for everyone to see.
  @Column({ type: 'timestamp', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'deleted_reason' })
  deletedReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
