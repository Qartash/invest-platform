import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { LogLevel, LogSource } from '../../common/enums';

@Entity('system_logs')
export class SystemLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: LogSource })
  source: LogSource;

  @Column({ type: 'enum', enum: LogLevel, default: LogLevel.INFO })
  level: LogLevel;

  @Index()
  @Column()
  category: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Index()
  @Column({ type: 'varchar', nullable: true, name: 'user_id' })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;
}
