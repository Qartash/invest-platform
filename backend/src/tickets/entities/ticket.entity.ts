import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TicketStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { EarningsSnapshot } from '../../earnings/entities/earnings-snapshot.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, (project) => project.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => User, (user) => user.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 14, scale: 2, name: 'purchase_price' })
  purchasePrice: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.ACTIVE })
  status: TicketStatus;

  @Column('decimal', { precision: 14, scale: 2, nullable: true, name: 'asking_price' })
  askingPrice: string | null;

  @OneToMany(() => EarningsSnapshot, (snapshot) => snapshot.ticket)
  earningsSnapshots: EarningsSnapshot[];

  @CreateDateColumn({ name: 'purchase_date' })
  purchaseDate: Date;
}
