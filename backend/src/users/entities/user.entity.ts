import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
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

  // Null for accounts that only ever signed in with Google — they have no
  // password to hash, and must not be able to log in through the password form.
  @Column({ type: 'varchar', nullable: true, name: 'password_hash' })
  passwordHash: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true, name: 'google_id' })
  googleId: string | null;

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

  // When false, other users see the name masked to first+last letters.
  @Column({ default: true, name: 'show_full_name' })
  showFullName: boolean;

  // The user's own share code, e.g. "ARTUR-4K9". Assigned once on creation and
  // never changed — it is baked into links people have already shared. Nullable
  // only so rows created before referrals existed don't block the migration;
  // every new account gets one.
  @Column({ type: 'varchar', unique: true, nullable: true, name: 'referral_code' })
  referralCode: string | null;

  // Who brought this user in. Set once at registration from the code they used
  // and never editable afterwards — the tree must reflect what actually happened.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'referred_by_id' })
  referredBy: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'referred_by_id' })
  referredById: string | null;

  // Materialised path of ancestors including self, dot-joined ids from the root
  // down to this user: "rootId.parentId.selfId.". A whole branch is everyone whose
  // path starts with this user's path; depth is the number of segments. `text`
  // because the chain has no depth limit. See ReferralsService.
  @Column({ type: 'text', nullable: true, name: 'referral_path' })
  referralPath: string | null;

  // Set when a partner application is approved. Partners earn a higher flat rate
  // on people they bring in personally, paid to a card instead of invest credit,
  // and earn nothing from depth. Null for everyone else.
  @Column({ type: 'timestamptz', nullable: true, name: 'partner_since' })
  partnerSince: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'banned_at' })
  bannedAt: Date | null;

  // Soft delete: financial history (wallet, tickets, transactions) must survive,
  // so profiles are never hard-deleted by moderation.
  @Column({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Project, (project) => project.founder)
  projects: Project[];

  @OneToMany(() => Ticket, (ticket) => ticket.owner)
  tickets: Ticket[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
