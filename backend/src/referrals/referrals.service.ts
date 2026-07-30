import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ReferralEarningsService } from './referral-earnings.service';
import { InviteEligibilityService } from './invite-eligibility.service';
import { INVITE_MIN_ACCOUNT_AGE_DAYS } from './invite-eligibility';

// One node of the community tree as the client draws it. Deliberately carries no
// email, phone, wallet or investment sum — the tree shows shape and belonging,
// never money or contacts.
export interface ReferralTreeNode {
  id: string;
  name: string;
  // True when the name is shown as an initial + dots. Every node past the first
  // level is masked; a first-level node is masked too if that person hid their
  // name. The client uses the flag to style it, not to unmask.
  masked: boolean;
  avatarEmoji: string | null;
  avatarUrl: string | null;
  // Distance from the viewer: 1 is someone they invited directly.
  depth: number;
  // How many people this node personally brought in — lets the client show
  // "invited 4" and a "show more" affordance without walking the whole subtree.
  directCount: number;
  // How much the viewer has earned from this person (level bonus + any 1%),
  // excluding cancelled rows. Shown beside the node.
  earned: number;
  // Whether this invitee has qualified (deposited or finished a streak). Drives
  // the active vs still-joining dot.
  qualified: boolean;
  joinedAt: Date;
  children: ReferralTreeNode[];
}

@Injectable()
export class ReferralsService implements OnModuleInit {
  // How deep the tree is returned in one call. The chain itself has no limit;
  // this only bounds a single response so a viewer high up a large tree doesn't
  // pull thousands of rows at once. Deeper levels are fetched on demand later.
  private static readonly DEFAULT_MAX_DEPTH = 4;

  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly earningsService: ReferralEarningsService,
    private readonly inviteEligibility: InviteEligibilityService,
  ) {}

  // Accounts that existed before referrals shipped have no code or path. The
  // feature is new, so none of them was referred by anyone — each is the root of
  // its own branch. Fill the two columns in for those rows once. Idempotent: it
  // only touches rows where the code is still null, so later boots do nothing.
  async onModuleInit(): Promise<void> {
    const pending = await this.usersRepository.find({ where: { referralCode: IsNull() } });
    if (pending.length === 0) return;
    for (const user of pending) {
      user.referralCode = await this.generateBackfillCode(user);
      user.referralPath = `${user.id}.`;
      await this.usersRepository.save(user);
    }
    this.logger.log(`Backfilled referral code/path for ${pending.length} pre-existing account(s)`);
  }

  private async generateBackfillCode(user: User): Promise<string> {
    const stem = (user.username || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'USER';
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
      const tail = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
      const code = `${stem}-${tail}`;
      if (!(await this.usersRepository.findOne({ where: { referralCode: code } }))) return code;
    }
  }

  private static dots(path: string): number {
    return (path.match(/\./g) ?? []).length;
  }

  // A name shown to someone else: the real one only when this is a direct invitee
  // AND they chose to show it; otherwise an initial followed by dots.
  private static present(user: User, reveal: boolean): { name: string; masked: boolean } {
    const full = user.fullName?.trim() || user.username || 'User';
    if (reveal && user.showFullName) {
      return { name: full, masked: false };
    }
    const first = [...full][0] ?? '•';
    return { name: `${first}•••`, masked: true };
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // The viewer's own share code and a couple of headline counts for the profile row.
  async getSummary(userId: string) {
    const me = await this.requireUser(userId);
    const path = me.referralPath ?? `${me.id}.`;

    const directCount = await this.usersRepository.count({ where: { referredById: me.id } });
    const branch = await this.usersRepository
      .createQueryBuilder('u')
      .where('u.referral_path LIKE :prefix', { prefix: `${path}%` })
      .andWhere('u.id != :id', { id: me.id })
      .getCount();
    const depth = await this.maxRelativeDepth(path);
    const earnings = await this.earningsService.totals(me.id);
    // Registration is invite-only, so a code that is not active yet is a link that refuses
    // everyone who follows it. The screen has to be able to say so, and say what is missing —
    // otherwise the first the inviter hears of it is a friend who could not sign up.
    const invite = await this.inviteEligibility.forUser(me);

    return {
      referralCode: me.referralCode,
      directCount,
      branchTotal: branch,
      maxDepth: depth,
      ...earnings,
      canInvite: invite.canInvite,
      inviteHasDeposited: invite.hasDeposited,
      inviteDaysUntilOldEnough: invite.daysUntilOldEnough,
      inviteMinAccountAgeDays: INVITE_MIN_ACCOUNT_AGE_DAYS,
    };
  }

  // Who brought the viewer in, or null if they started their own branch. Honours
  // the referrer's own name-privacy just like a first-level node does.
  async getReferrer(userId: string) {
    const me = await this.requireUser(userId);
    if (!me.referredById) return null;
    const referrer = await this.usersRepository.findOne({ where: { id: me.referredById } });
    if (!referrer) return null;
    const { name, masked } = ReferralsService.present(referrer, true);
    return {
      id: referrer.id,
      name,
      masked,
      avatarEmoji: referrer.avatarEmoji,
      avatarUrl: referrer.avatarUrl,
      joinedAt: me.createdAt,
    };
  }

  // The nested tree beneath the viewer, capped at `maxDepth` levels.
  async getTree(userId: string, maxDepth = ReferralsService.DEFAULT_MAX_DEPTH): Promise<ReferralTreeNode[]> {
    const me = await this.requireUser(userId);
    const path = me.referralPath ?? `${me.id}.`;
    const rootDots = ReferralsService.dots(path);

    const rows = await this.usersRepository
      .createQueryBuilder('u')
      .where('u.referral_path LIKE :prefix', { prefix: `${path}%` })
      .andWhere('u.id != :id', { id: me.id })
      // Segment count minus the viewer's = relative depth; keep only within cap.
      .andWhere('(length(u.referral_path) - length(replace(u.referral_path, :dot, :empty))) <= :maxDots', {
        dot: '.',
        empty: '',
        maxDots: rootDots + maxDepth,
      })
      .orderBy('u.referral_path', 'ASC')
      .getMany();

    // Count direct children per node in one pass over the fetched set. A node at
    // the cap depth will read directCount 0 here even if it has children below the
    // cap — acceptable for a bounded view; the exact count comes when it's expanded.
    const directCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.referredById) {
        directCounts.set(row.referredById, (directCounts.get(row.referredById) ?? 0) + 1);
      }
    }

    // What the viewer earned from each fetched invitee, and which of them have
    // qualified — two set-based lookups rather than a query per node.
    const ids = rows.map((r) => r.id);
    const earnedBySource = await this.earningsService.earnedBySource(me.id, ids);
    const qualified = await this.earningsService.qualifiedSourceIds(ids);

    const nodes = new Map<string, ReferralTreeNode>();
    for (const row of rows) {
      const depth = ReferralsService.dots(row.referralPath ?? '') - rootDots;
      const { name, masked } = ReferralsService.present(row, depth === 1);
      nodes.set(row.id, {
        id: row.id,
        name,
        masked,
        avatarEmoji: row.avatarEmoji,
        avatarUrl: row.avatarUrl,
        depth,
        directCount: directCounts.get(row.id) ?? 0,
        earned: earnedBySource.get(row.id) ?? 0,
        qualified: qualified.has(row.id),
        joinedAt: row.createdAt,
        children: [],
      });
    }

    // Attach each node to its parent; anything whose parent is the viewer (or
    // whose parent fell outside the fetched set) becomes a root of the result.
    const roots: ReferralTreeNode[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id)!;
      const parent = row.referredById ? nodes.get(row.referredById) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  // The earnings ledger for the history screen, with each source invitee's name
  // masked the same way the tree masks it: revealed only for a direct invitee who
  // shows their name.
  async getEarningsHistory(userId: string) {
    const rows = await this.earningsService.history(userId);
    const sources = await this.usersRepository.find({
      where: { id: In(rows.map((r) => r.sourceUserId)) },
    });
    const byId = new Map(sources.map((u) => [u.id, u]));
    return rows.map((r) => {
      const source = byId.get(r.sourceUserId);
      const present = source
        ? ReferralsService.present(source, r.level === 1)
        : { name: '—', masked: true };
      return {
        id: r.id,
        sourceName: present.name,
        masked: present.masked,
        level: r.level,
        type: r.type,
        amount: Number(r.amount),
        status: r.status,
        maturesAt: r.maturesAt,
        createdAt: r.createdAt,
      };
    });
  }

  // Voids an invitee's still-held earnings across every ancestor — refund or
  // fraud handling, admin-triggered.
  cancelForInvitee(inviteeId: string): Promise<number> {
    return this.earningsService.cancelBySourceUser(inviteeId);
  }

  // The deepest relative level anyone in the branch sits at, for the stats row.
  // The prefix match includes the viewer's own row (at rootDots), so with no
  // descendants the max is rootDots and the result is 0.
  private async maxRelativeDepth(path: string): Promise<number> {
    const rootDots = ReferralsService.dots(path);
    const row = await this.usersRepository
      .createQueryBuilder('u')
      .select('MAX(length(u.referral_path) - length(replace(u.referral_path, :dot, :empty)))', 'maxdots')
      .where('u.referral_path LIKE :prefix', { prefix: `${path}%` })
      .setParameters({ dot: '.', empty: '' })
      .getRawOne<{ maxdots: string | null }>();
    const maxDots = row?.maxdots ? Number(row.maxdots) : rootDots;
    return Math.max(0, maxDots - rootDots);
  }
}
