import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { ReferralEarning } from './entities/referral-earning.entity';
import { User } from '../users/entities/user.entity';
import {
  EarningChannel,
  ReferralEarningStatus,
  ReferralEarningType,
  TransactionAccount,
  TransactionType,
  UserRole,
} from '../common/enums';
import { REFERRAL_HOLD_DAYS, firstDepositCut, priceForAncestor } from './ladder';
import { lockWallets } from '../common/row-locks';
import { Transaction } from '../transactions/entities/transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotifyInput } from '../notifications/notification-types';

@Injectable()
export class ReferralEarningsService {
  private readonly logger = new Logger(ReferralEarningsService.name);

  constructor(
    @InjectRepository(ReferralEarning)
    private readonly earningsRepository: Repository<ReferralEarning>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // An accrual is money the beneficiary cannot touch yet — it sits in the hold
  // until it matures — so the notice says what was earned and when it unlocks,
  // and a second one goes out when it is actually paid.
  private accrualNotice(earning: ReferralEarning): NotifyInput {
    return {
      userId: earning.beneficiaryId,
      type: NotificationType.REFERRAL_EARNING_ACCRUED,
      payload: {
        amount: parseFloat(earning.amount),
        level: earning.level,
        earningType: earning.type,
        channel: earning.channel,
        maturesAt: earning.maturesAt.toISOString(),
      },
    };
  }

  // ── Accrual ────────────────────────────────────────────────────────────────

  // Called when an invitee makes a deposit. A deposit both qualifies the invitee
  // (firing the ladder for their whole chain, once) and, if it's their first,
  // pays the direct referrer 1% of it. Safe to call on every deposit: each part
  // guards against firing twice.
  async handleDeposit(inviteeId: string, amount: number, triggerTransactionId: string): Promise<void> {
    const invitee = await this.usersRepository.findOne({ where: { id: inviteeId } });
    if (!invitee || !invitee.referredById) return; // a root account earns no one anything

    await this.qualifyInvitee(invitee, triggerTransactionId);

    const alreadyPaidPercent = await this.earningsRepository.count({
      where: { sourceUserId: invitee.id, type: ReferralEarningType.DEPOSIT_PERCENT },
    });
    if (alreadyPaidPercent === 0) {
      // A partner takes a larger cut of the first deposit, capped, and in cash.
      const referrer = await this.usersRepository.findOne({ where: { id: invitee.referredById } });
      const cut = firstDepositCut(amount, !!referrer?.partnerSince);
      if (cut.amount > 0) {
        const earning = await this.earningsRepository.save(
          this.earningsRepository.create({
            beneficiaryId: invitee.referredById,
            sourceUserId: invitee.id,
            level: 1,
            type: ReferralEarningType.DEPOSIT_PERCENT,
            amount: cut.amount.toFixed(2),
            status: ReferralEarningStatus.PENDING,
            channel: cut.toCard ? EarningChannel.CARD : EarningChannel.INVEST,
            maturesAt: this.holdUntil(),
            triggerTransactionId,
          }),
        );
        await this.notifications.notify(this.accrualNotice(earning));
      }
    }
  }

  // Fires the flat ladder for every ancestor of a newly-qualified invitee. The
  // trigger may be a deposit or a completed 7-day streak (the streak path calls
  // this directly). Idempotent: an invitee who already qualified earns the ladder
  // no second time.
  async qualifyInvitee(invitee: User, triggerTransactionId: string | null): Promise<void> {
    const already = await this.earningsRepository.count({
      where: { sourceUserId: invitee.id, type: ReferralEarningType.LEVEL_BONUS },
    });
    if (already > 0) return;

    const ancestors = ReferralEarningsService.ancestorsWithLevels(invitee);
    if (ancestors.length === 0) return;

    // Partners are paid a flat rate for their own invitees and nothing for depth,
    // so the ladder has to know which ancestors are partners before pricing it.
    const ancestorUsers = await this.usersRepository.find({
      where: { id: In(ancestors.map((a) => a.id)) },
      select: { id: true, partnerSince: true },
    });
    const partnerIds = new Set(ancestorUsers.filter((u) => u.partnerSince).map((u) => u.id));

    const rows = ancestors
      .map(({ id, level }) => ({ id, level, price: priceForAncestor(level, partnerIds.has(id)) }))
      .filter((a): a is { id: string; level: number; price: { amount: number; toCard: boolean } } => a.price !== null)
      .map((a) =>
        this.earningsRepository.create({
          beneficiaryId: a.id,
          sourceUserId: invitee.id,
          level: a.level,
          type: ReferralEarningType.LEVEL_BONUS,
          amount: a.price.amount.toFixed(2),
          status: ReferralEarningStatus.PENDING,
          channel: a.price.toCard ? EarningChannel.CARD : EarningChannel.INVEST,
          maturesAt: this.holdUntil(),
          triggerTransactionId,
        }),
      );
    const saved = await this.earningsRepository.save(rows);
    // One notice per ancestor. A deep chain means several people earned from the
    // same qualification, and each of them earned it — this is not a broadcast.
    await this.notifications.notifyMany(saved.map((earning) => this.accrualNotice(earning)));
  }

  // Ancestors of an invitee with their relative level, closest first (level 1 is
  // the direct referrer). Derived from the materialised path, whose last segment
  // is the invitee themselves.
  private static ancestorsWithLevels(invitee: User): { id: string; level: number }[] {
    const segments = (invitee.referralPath ?? '').split('.').filter(Boolean);
    const ancestors = segments.slice(0, -1); // drop self
    return ancestors.reverse().map((id, index) => ({ id, level: index + 1 }));
  }

  private holdUntil(): Date {
    const d = new Date();
    d.setDate(d.getDate() + REFERRAL_HOLD_DAYS);
    return d;
  }

  // ── Maturation & payout ──────────────────────────────────────────────────

  // Once an hour, pay everything whose hold has ended: move the amount from the
  // admin account's balance into the beneficiary's invest credit. Each earning is
  // its own transaction so one underfunded or blocked payout never stalls the rest.
  @Cron(CronExpression.EVERY_HOUR)
  async payMaturedEarnings(): Promise<void> {
    await this.flagPartnerPayoutsDue();

    const due = await this.earningsRepository.find({
      // Only invest-credit earnings are paid automatically. A partner's cash is
      // settled monthly against an invoice by a person, not by this job.
      where: {
        status: ReferralEarningStatus.PENDING,
        channel: EarningChannel.INVEST,
        maturesAt: LessThanOrEqual(new Date()),
      },
      order: { createdAt: 'ASC' },
    });
    if (due.length === 0) return;

    const admin = await this.getFundingAdmin();
    if (!admin) {
      this.logger.warn(`${due.length} referral earning(s) matured but no admin account funds them`);
      await this.warnPoolStuck(due.length, 'no_admin');
      return;
    }

    const notices: NotifyInput[] = [];
    let paid = 0;
    for (const earning of due) {
      try {
        const payment = await this.payOne(earning.id, admin.id);
        if (payment) {
          paid += 1;
          notices.push({
            userId: payment.beneficiaryId,
            type: NotificationType.REFERRAL_EARNING_PAID,
            payload: { amount: payment.amount, channel: EarningChannel.INVEST },
          });
        }
      } catch (err) {
        this.logger.error(`Failed to pay referral earning ${earning.id}`, err as Error);
      }
    }
    await this.notifications.notifyMany(notices);
    if (paid > 0) this.logger.log(`Paid ${paid}/${due.length} matured referral earning(s)`);
    // Everything matured and nothing could be paid means the pool is dry (or has
    // nobody to draw from). Until now that was a log line on a server nobody
    // reads, while people waited on rewards the app had already promised them.
    if (paid === 0) await this.warnPoolStuck(due.length, 'unfunded');
  }

  // A partner's cash never moves on a schedule — a person makes the transfer and
  // then records it. Nothing used to say when there was something to transfer,
  // so the queue was only found by opening it.
  private async flagPartnerPayoutsDue(): Promise<void> {
    const due = await this.duePartnerPayouts();
    if (due.length === 0) return;
    const total = due.reduce((sum, row) => sum + row.amount, 0);
    await this.notifications.notifyAdmins(
      NotificationType.MOD_PARTNER_PAYOUT_DUE,
      { partners: due.length, amount: Math.round(total * 100) / 100 },
      // One standing reminder while it is unread. Settling the payouts empties
      // the queue; reading the notice arms the next one for whatever accrues
      // after it.
      { dedupeKey: 'partner-payouts' },
    );
  }

  // Deduped on the reason, so an hourly job that keeps finding the same empty
  // pool leaves one unread warning rather than twenty-four. Marking it read is
  // what re-arms it: the next run after a moderator has looked warns again.
  private warnPoolStuck(count: number, reason: 'no_admin' | 'unfunded'): Promise<void> {
    return this.notifications.notifyAdmins(
      NotificationType.MOD_REFERRAL_POOL_EMPTY,
      { count, reason },
      { dedupeKey: reason },
    );
  }

  // Pays a single earning inside one locked transaction. Returns false (leaving it
  // PENDING to retry) when the admin can't fund it; cancels it when the
  // beneficiary is gone.
  private async payOne(
    earningId: string,
    adminId: string,
  ): Promise<{ beneficiaryId: string; amount: number } | null> {
    return this.dataSource.transaction(async (manager) => {
      const earning = await manager.findOne(ReferralEarning, {
        where: { id: earningId },
        lock: { mode: 'pessimistic_write' },
      });
      // Re-check under the lock: a concurrent cancel may have voided it.
      if (!earning || earning.status !== ReferralEarningStatus.PENDING) return null;

      const beneficiary = await manager.findOne(User, { where: { id: earning.beneficiaryId } });
      if (!beneficiary || beneficiary.deletedAt) {
        earning.status = ReferralEarningStatus.CANCELLED;
        await manager.save(earning);
        return null;
      }

      const amount = parseFloat(earning.amount);
      const wallets = await lockWallets(manager, [adminId, earning.beneficiaryId]);
      const adminWallet = wallets.get(adminId)!;
      const beneficiaryWallet = wallets.get(earning.beneficiaryId)!;

      if (parseFloat(adminWallet.balance) < amount) {
        return null; // admin out of funds — try again next run
      }

      adminWallet.balance = (parseFloat(adminWallet.balance) - amount).toFixed(2);
      beneficiaryWallet.investCredit = (parseFloat(beneficiaryWallet.investCredit) + amount).toFixed(2);
      await manager.save([adminWallet, beneficiaryWallet]);

      // The beneficiary's credit is the auditable side; anchor the earning to it.
      const credit = await manager.save(
        manager.create(Transaction, {
          userId: earning.beneficiaryId,
          type: TransactionType.REFERRAL_BONUS,
          amount: amount.toFixed(2),
          account: TransactionAccount.INVEST,
          description: 'Referral reward',
        }),
      );
      // The admin's funding side, so the pool's outflow is visible too.
      await manager.save(
        manager.create(Transaction, {
          userId: adminId,
          type: TransactionType.REFERRAL_BONUS,
          amount: (-amount).toFixed(2),
          account: TransactionAccount.BALANCE,
          description: 'Referral pool payout',
        }),
      );

      earning.status = ReferralEarningStatus.PAID;
      earning.payoutTransactionId = credit.id;
      await manager.save(earning);
      return { beneficiaryId: earning.beneficiaryId, amount };
    });
  }

  // The account the pool draws from: the oldest admin. Bonuses are the platform's
  // marketing spend, so they come out of its own balance, never from invitees'.
  private getFundingAdmin(): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { role: UserRole.ADMIN },
      order: { createdAt: 'ASC' },
    });
  }

  // ── Cancellation (refund / fraud) ─────────────────────────────────────────

  // Voids every still-held earning triggered by an invitee — used when their
  // deposit is refunded or the account is judged fraudulent. Already-paid
  // earnings are left untouched; the 14-day hold exists so that in practice this
  // runs before payout.
  async cancelBySourceUser(inviteeId: string): Promise<number> {
    // Read before the update: afterwards there is no telling these rows apart
    // from earnings cancelled by an earlier pass over the same invitee.
    const doomed = await this.earningsRepository.find({
      where: { sourceUserId: inviteeId, status: ReferralEarningStatus.PENDING },
      select: { id: true, beneficiaryId: true, amount: true },
    });
    const { affected } = await this.earningsRepository.update(
      { sourceUserId: inviteeId, status: ReferralEarningStatus.PENDING },
      { status: ReferralEarningStatus.CANCELLED },
    );
    // Money that was shown as "in the hold" and will now never arrive. Saying so
    // is the difference between a reversal and a figure that quietly shrank.
    await this.notifications.notifyMany(
      doomed.map((earning) => ({
        userId: earning.beneficiaryId,
        type: NotificationType.REFERRAL_EARNING_CANCELLED,
        payload: { amount: parseFloat(earning.amount) },
      })),
    );
    return affected ?? 0;
  }

  // ── Reads for the screens ─────────────────────────────────────────────────

  // Totals for the invites header: everything ever earned, what's spendable now
  // (paid into invest credit), and what's still in the hold. Card earnings are a
  // partner's cash and belong on the partner cabinet, not here.
  totals(beneficiaryId: string) {
    return this.totalsByChannel(beneficiaryId, EarningChannel.INVEST);
  }

  // The same three figures for a partner's cash: earned, settled, and waiting for
  // the next monthly payout.
  partnerTotals(beneficiaryId: string) {
    return this.totalsByChannel(beneficiaryId, EarningChannel.CARD);
  }

  private async totalsByChannel(beneficiaryId: string, channel: EarningChannel) {
    const rows = await this.earningsRepository
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.beneficiary_id = :id', { id: beneficiaryId })
      .andWhere('e.channel = :channel', { channel })
      .groupBy('e.status')
      .getRawMany<{ status: ReferralEarningStatus; sum: string }>();

    const byStatus = new Map(rows.map((r) => [r.status, Number(r.sum)]));
    const paid = byStatus.get(ReferralEarningStatus.PAID) ?? 0;
    const pending = byStatus.get(ReferralEarningStatus.PENDING) ?? 0;
    return { earnedTotal: paid + pending, earnedAvailable: paid, earnedPending: pending };
  }

  // Matured partner earnings that are owed but not yet settled — what an admin
  // pays out at the end of the month.
  async duePartnerPayouts() {
    const rows = await this.earningsRepository.find({
      where: {
        status: ReferralEarningStatus.PENDING,
        channel: EarningChannel.CARD,
        maturesAt: LessThanOrEqual(new Date()),
      },
      order: { beneficiaryId: 'ASC', createdAt: 'ASC' },
    });
    const byBeneficiary = new Map<string, { beneficiaryId: string; amount: number; earningIds: string[] }>();
    for (const row of rows) {
      const entry = byBeneficiary.get(row.beneficiaryId) ?? {
        beneficiaryId: row.beneficiaryId,
        amount: 0,
        earningIds: [],
      };
      entry.amount += Number(row.amount);
      entry.earningIds.push(row.id);
      byBeneficiary.set(row.beneficiaryId, entry);
    }
    return [...byBeneficiary.values()];
  }

  // Marks a partner's matured earnings as settled once the transfer has actually
  // been made outside the platform. Deliberately explicit: nothing here moves
  // money, it only records that a person did.
  async settlePartnerEarnings(earningIds: string[]): Promise<number> {
    if (earningIds.length === 0) return 0;
    // Same reason as the cancellation above: the rows have to be read while they
    // still say PENDING to know whose payout this settles.
    const settling = await this.earningsRepository.find({
      where: { id: In(earningIds), status: ReferralEarningStatus.PENDING, channel: EarningChannel.CARD },
      select: { id: true, beneficiaryId: true, amount: true },
    });
    const { affected } = await this.earningsRepository.update(
      { id: In(earningIds), status: ReferralEarningStatus.PENDING, channel: EarningChannel.CARD },
      { status: ReferralEarningStatus.PAID },
    );

    // The transfer happened off-platform, so this notice is the only thing that
    // tells a partner the money is on its way. One line per partner rather than
    // per earning — they were paid once.
    const byPartner = new Map<string, number>();
    for (const earning of settling) {
      byPartner.set(earning.beneficiaryId, (byPartner.get(earning.beneficiaryId) ?? 0) + parseFloat(earning.amount));
    }
    await this.notifications.notifyMany(
      [...byPartner].map(([beneficiaryId, amount]) => ({
        userId: beneficiaryId,
        type: NotificationType.PARTNER_PAYOUT_SETTLED,
        payload: { amount: Math.round(amount * 100) / 100 },
      })),
    );
    return affected ?? 0;
  }

  // The earnings ledger for the history screen, newest first.
  history(beneficiaryId: string): Promise<ReferralEarning[]> {
    return this.earningsRepository.find({
      where: { beneficiaryId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  // How much the viewer earned from each of the given invitees, for the amount
  // shown beside a tree node.
  async earnedBySource(beneficiaryId: string, sourceIds: string[]): Promise<Map<string, number>> {
    if (sourceIds.length === 0) return new Map();
    const rows = await this.earningsRepository
      .createQueryBuilder('e')
      .select('e.source_user_id', 'source')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.beneficiary_id = :id', { id: beneficiaryId })
      .andWhere('e.source_user_id IN (:...ids)', { ids: sourceIds })
      .andWhere('e.status != :cancelled', { cancelled: ReferralEarningStatus.CANCELLED })
      .groupBy('e.source_user_id')
      .getRawMany<{ source: string; sum: string }>();
    return new Map(rows.map((r) => [r.source, Number(r.sum)]));
  }

  // Which of the given invitees have qualified (fired their ladder), so a tree
  // node can read active vs still-joining.
  async qualifiedSourceIds(sourceIds: string[]): Promise<Set<string>> {
    if (sourceIds.length === 0) return new Set();
    const rows = await this.earningsRepository.find({
      where: { sourceUserId: In(sourceIds), type: ReferralEarningType.LEVEL_BONUS },
      select: { sourceUserId: true },
    });
    return new Set(rows.map((r) => r.sourceUserId));
  }
}
