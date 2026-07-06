import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('project_attachments')
export class ProjectAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'int', name: 'file_size' })
  fileSize: number;

  @Column({ type: 'varchar', nullable: true, name: 'mime_type' })
  mimeType: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
