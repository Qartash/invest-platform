import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Gender, KycStatus, UserRole } from '../../common/enums';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { Project } from '../../projects/entities/project.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  telegram: string;

  @Column({ type: 'date', nullable: true, name: 'birth_date' })
  birthDate: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.INVESTOR })
  role: UserRole;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.NONE, name: 'kyc_status' })
  kycStatus: KycStatus;

  @Column({ default: 'hy', name: 'language_pref' })
  languagePref: string;

  @Column({ type: 'varchar', nullable: true, name: 'avatar_url' })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true, name: 'avatar_emoji' })
  avatarEmoji: string | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true })
  occupation: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkedin: string | null;

  @Column({ default: false, name: 'share_contacts_publicly' })
  shareContactsPublicly: boolean;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Project, (project) => project.founder)
  projects: Project[];

  @OneToMany(() => Ticket, (ticket) => ticket.owner)
  tickets: Ticket[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
