import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Project } from './project.entity';

// The people behind a project, as the founder wants to present them. Deliberately not tied
// to platform accounts: a baker's co-founder or accountant usually has no account here, and
// requiring one would mean half the team could never be shown.
@Entity('project_team_members')
export class ProjectTeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'text' })
  name: string;

  // Free text ("Основатель, пекарь"), not an enum — every project spells its roles its own way.
  @Column({ type: 'text' })
  role: string;

  @Column({ type: 'varchar', nullable: true, name: 'photo_url' })
  photoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column('int')
  order: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
