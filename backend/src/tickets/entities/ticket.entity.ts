import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TicketStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Project } from '../../projects/entities/project.entity';
import { EarningsSnapshot } from '../../earnings/entities/earnings-snapshot.entity';

// "Which tickets does this user hold" is the first question the portfolio asks and the
// one every other query there depends on, so owner_id gets an index of its own — the
// foreign key constraint is not one.
@Entity('tickets')
@Index('IDX_tickets_owner', ['ownerId'])
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

  // True once this holding was bought off another investor rather than from the project.
  // purchasePrice then carries what the buyer paid on the secondary market, which has
  // nothing to do with the project's round ladder and never reached the project's
  // treasury — so a resold holding must be kept out of the round price history and out
  // of any figure meant to represent what the project raised.
  @Column({ type: 'boolean', default: false, name: 'acquired_via_resale' })
  acquiredViaResale: boolean;

  @OneToMany(() => EarningsSnapshot, (snapshot) => snapshot.ticket)
  earningsSnapshots: EarningsSnapshot[];

  @CreateDateColumn({ name: 'purchase_date' })
  purchaseDate: Date;
}
