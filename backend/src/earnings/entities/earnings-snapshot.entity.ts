import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';

// The portfolio reads this table by ticket and by date — the newest valuation of a
// ticket, and its value on two particular days. Postgres does not index a foreign key
// column on its own, so without this every one of those reads scanned the whole table.
@Entity('earnings_snapshots')
@Index('IDX_earnings_snapshots_ticket_date', ['ticketId', 'date'])
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
