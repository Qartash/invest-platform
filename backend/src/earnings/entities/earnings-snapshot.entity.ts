import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('earnings_snapshots')
export class EarningsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.earningsSnapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ type: 'date' })
  date: string;

  @Column('decimal', { precision: 14, scale: 2 })
  value: string;

  @Column('decimal', { precision: 8, scale: 4, name: 'daily_return' })
  dailyReturn: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
