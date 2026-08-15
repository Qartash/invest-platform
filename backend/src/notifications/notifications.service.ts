import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { NotificationPayload, NotificationType, NotifyInput } from './notification-types';
import { withCronLock } from '../common/cron-lock';

// A payload is a handful of ids and figures. This is a backstop against a stray
// long string (a moderator's comment, a rejection reason) rather than a budget.
const MAX_PAYLOAD_STRING = 500;

// Read notifications are kept long enough to be scrolled back through and no
// longer; unread ones survive far past the point of being useful to anybody, but
// deleting something a person has never seen is worse than keeping it.
const READ_RETENTION_DAYS = 90;
const UNREAD_RETENTION_DAYS = 365;

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // Four in the morning is a time this process is frequently not awake for, so the purge
  // also runs on boot — see the note on `purgeOld`. Not awaited: housekeeping must not be
  // something starting up can wait on or fail from.
  onModuleInit(): void {
    void this.purgeOld();
  }

  // ── Sending ────────────────────────────────────────────────────────────────
  //
  // Nothing in here throws. A notification is a note about something that has
  // already happened, so failing to write one must never undo the thing it is
  // about — a purchase that goes through and then 500s because the bell could
  // not be updated is strictly worse than a silent bell.
  //
  // For the same reason these are called *after* the transaction that did the
  // work has committed, never inside it. Callers that work in a transaction
  // collect their notifications in a local array and send them once it returns:
  // inside, a failed insert would poison the surrounding transaction and roll
  // the real work back, and a successful one would announce money that a later
  // rollback then took away.

  async notify(input: NotifyInput): Promise<void> {
    await this.notifyMany([input]);
  }

  async notifyMany(inputs: NotifyInput[]): Promise<void> {
    if (inputs.length === 0) return;
    try {
      const rows = await this.buildRows(inputs);
      // save rather than insert: the payload is a free-form jsonb object, which
      // insert's deep-partial typing cannot express.
      if (rows.length > 0) await this.notificationsRepository.save(rows);
    } catch (err) {
      this.logger.error(`Failed to write ${inputs.length} notification(s)`, err as Error);
    }
  }

  /**
   * The moderator queue. Sends to every active administrator, minus `exceptUserId`
   * — the admin who performed the action already knows they performed it.
   */
  async notifyAdmins(
    type: NotificationType,
    payload?: NotificationPayload | null,
    options: { exceptUserId?: string; dedupeKey?: string } = {},
  ): Promise<void> {
    try {
      const admins = await this.usersRepository.find({
        where: { role: UserRole.ADMIN, bannedAt: IsNull(), deletedAt: IsNull() },
        select: { id: true },
      });
      const recipients = admins.filter((admin) => admin.id !== options.exceptUserId);
      await this.notifyMany(
        recipients.map((admin) => ({
          userId: admin.id,
          type,
          payload,
          dedupeKey: options.dedupeKey ?? null,
        })),
      );
    } catch (err) {
      this.logger.error(`Failed to notify admins about ${type}`, err as Error);
    }
  }

  private async buildRows(inputs: NotifyInput[]): Promise<Notification[]> {
    const deduped = await this.dropAlreadyPending(inputs);
    return deduped.map((input) =>
      this.notificationsRepository.create({
        userId: input.userId,
        type: input.type,
        payload: NotificationsService.trimPayload(input.payload ?? null),
        dedupeKey: input.dedupeKey ?? null,
        readAt: null,
      }),
    );
  }

  // Drops the inputs whose (user, type, key) already sits unread. Checked in one
  // query for the whole batch rather than one per row — an hourly job that
  // notifies every administrator would otherwise pay a round trip each.
  private async dropAlreadyPending(inputs: NotifyInput[]): Promise<NotifyInput[]> {
    const keyed = inputs.filter((input) => !!input.dedupeKey);
    if (keyed.length === 0) return inputs;

    const existing = await this.notificationsRepository.find({
      where: {
        userId: In([...new Set(keyed.map((input) => input.userId))]),
        type: In([...new Set(keyed.map((input) => input.type))]),
        dedupeKey: In([...new Set(keyed.map((input) => input.dedupeKey!))]),
        readAt: IsNull(),
      },
      select: { userId: true, type: true, dedupeKey: true },
    });
    if (existing.length === 0) return inputs;

    // The query above is a cross product of the three sets, so a hit only counts
    // against the exact triple it matches.
    const taken = new Set(existing.map((row) => `${row.userId}|${row.type}|${row.dedupeKey}`));
    return inputs.filter(
      (input) => !input.dedupeKey || !taken.has(`${input.userId}|${input.type}|${input.dedupeKey}`),
    );
  }

  private static trimPayload(payload: NotificationPayload | null): NotificationPayload | null {
    if (!payload) return null;
    const trimmed: NotificationPayload = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) continue;
      trimmed[key] =
        typeof value === 'string' && value.length > MAX_PAYLOAD_STRING
          ? `${value.slice(0, MAX_PAYLOAD_STRING)}…`
          : value;
    }
    return trimmed;
  }

  // ── Reading ────────────────────────────────────────────────────────────────

  async list(userId: string, page: number, pageSize: number) {
    const [items, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        payload: item.payload,
        read: !!item.readAt,
        createdAt: item.createdAt,
      })),
      total,
      page,
      pageSize,
      // Carried on the list response as well as its own endpoint, so opening the
      // screen refreshes the badge without a second request.
      unread: await this.unreadCount(userId),
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string): Promise<{ unread: number }> {
    // Scoped by userId, not just id: without it, knowing an id would be enough to
    // clear somebody else's bell.
    const { affected } = await this.notificationsRepository.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    if (!affected) {
      // Either it is not theirs, or they have already read it. Tell the two apart
      // so a double tap is not reported as a missing notification.
      const exists = await this.notificationsRepository.exists({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { unread: await this.unreadCount(userId) };
  }

  async markAllRead(userId: string): Promise<{ unread: number }> {
    await this.notificationsRepository.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { unread: 0 };
  }

  // ── Housekeeping ───────────────────────────────────────────────────────────

  /**
   * Nothing in the app reads a notification from last spring, and every account adds rows
   * for as long as it is used. Sweeping nightly keeps the table's size a function of how
   * busy the platform is rather than of how old it is.
   *
   * "Nightly" was doing less than it looked like: the API sleeps when nothing is calling
   * it, and four in the morning is the least likely hour of the day for anybody to be
   * calling it — so on a quiet week this ran zero times, not seven. It runs on boot too
   * now, which is a moment that genuinely happens.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOld(): Promise<void> {
    try {
      await withCronLock(this.dataSource, 'notifications-purge', async () => {
        const readBefore = NotificationsService.daysAgo(READ_RETENTION_DAYS);
        const anyBefore = NotificationsService.daysAgo(UNREAD_RETENTION_DAYS);
        const read = await this.notificationsRepository.delete({
          readAt: LessThan(readBefore),
        });
        const old = await this.notificationsRepository.delete({ createdAt: LessThan(anyBefore) });
        const removed = (read.affected ?? 0) + (old.affected ?? 0);
        if (removed > 0) this.logger.log(`Purged ${removed} old notification(s)`);
      });
    } catch (err) {
      this.logger.error('Failed to purge old notifications', err as Error);
    }
  }

  private static daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
