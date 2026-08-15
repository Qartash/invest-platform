import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestScope, QuestVerification } from '../../common/enums';
import { Project } from '../../projects/entities/project.entity';

// A small paid task. Two kinds live here, and the difference is who funds them:
// platform quests are the platform's own marketing spend, project quests are a
// founder buying attention for their project out of its budget. Both pay into
// invest credit through the same admin-funded path, so neither ever touches
// another user's money.
@Entity('quests')
export class Quest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stable identifier for the built-in platform quests, so the client can look up
  // a translated title instead of showing text stored in the database. Null for
  // project quests, whose wording the founder writes themselves.
  @Column({ type: 'varchar', unique: true, nullable: true })
  key: string | null;

  @Column({ type: 'enum', enum: QuestScope })
  scope: QuestScope;

  // How a completion is proven: the server checks a rule, the client reports it
  // (watching a video), or a moderator confirms it (a bug report).
  @Column({ type: 'enum', enum: QuestVerification })
  verification: QuestVerification;

  // Which server-side rule proves an `auto` quest. Null for the other kinds.
  @Column({ type: 'varchar', nullable: true })
  rule: string | null;

  // Wording for project quests. Platform quests leave these null and are
  // translated client-side from `key`.
  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'video_url' })
  videoUrl: string | null;

  @Column('decimal', { precision: 14, scale: 2 })
  reward: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @Column({ type: 'uuid', nullable: true, name: 'project_id' })
  projectId: string | null;

  // Retired quests stay in the table so completed rows keep their meaning.
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
