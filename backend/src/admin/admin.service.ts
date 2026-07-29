import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash, timingSafeEqual } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { LogsService } from '../logs/logs.service';
import { QuestsService } from '../quests/quests.service';
import { invalidateAllCached } from '../common/response-cache';

/**
 * Tables the wipe must not touch.
 *
 * `migrations` records which migrations have run — emptying it makes the next boot
 * replay every one of them against a schema that already has them. `users` survives
 * the TRUNCATE only so the admin doing the wipe keeps their account; every other row
 * in it is deleted immediately afterwards. Nothing else references `users`' rows by
 * the time that happens, because everything that could has already been truncated.
 */
const PRESERVED_TABLES = new Set(['migrations', 'typeorm_metadata']);

const UPLOAD_SUBDIRS = ['projects', 'attachments', 'avatars'];

export interface WipeResult {
  tablesCleared: number;
  usersDeleted: number;
  filesDeleted: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Wallet) private readonly walletsRepository: Repository<Wallet>,
    private readonly logsService: LogsService,
    private readonly questsService: QuestsService,
  ) {}

  /**
   * Empties the platform: every project, ticket, transaction, wallet, log and user
   * account disappears, along with every uploaded file. The one thing left standing is
   * the admin who asked for it — without that account nobody could sign in afterwards,
   * and the database has no other way back in.
   *
   * There is no undo. The only recovery is a database backup taken beforehand.
   */
  async wipeEverything(adminId: string, password: string): Promise<WipeResult> {
    this.assertPassword(password);

    const tables = await this.publicTables();
    const toTruncate = tables.filter((t) => t !== 'users' && !PRESERVED_TABLES.has(t));

    if (toTruncate.length > 0) {
      const quoted = toTruncate.map((t) => `"public"."${t}"`).join(', ');
      // One statement, so no foreign key is ever left pointing at a row that has already
      // gone. CASCADE covers anything referencing these; RESTART IDENTITY resets counters.
      await this.dataSource.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    }

    const deleted = await this.usersRepository.delete({ id: Not(adminId) });

    await this.resetSurvivingAdmin(adminId);
    const filesDeleted = await this.clearUploads();

    // Both of these seed themselves at boot and both were just emptied; re-running the
    // same idempotent seeding puts the platform quest catalogue and the log settings row
    // back without waiting for a restart.
    await this.questsService.onModuleInit();
    await this.logsService.onModuleInit();

    // Server-side caches still hold answers computed from the data that no longer exists.
    invalidateAllCached();

    const result: WipeResult = {
      tablesCleared: toTruncate.length,
      usersDeleted: deleted.affected ?? 0,
      filesDeleted,
    };
    this.logger.warn(
      `Platform wiped by admin ${adminId}: ${result.tablesCleared} table(s), ` +
        `${result.usersDeleted} user(s), ${result.filesDeleted} file(s) removed`,
    );
    return result;
  }

  /**
   * The admin row survived the wipe, so it still carries everything the old data gave it:
   * a referrer who no longer exists, a partner flag, an avatar whose file was just deleted.
   * Put the account back to how a freshly created one looks, keeping only what identifies
   * it — id, credentials, role and its own referral code, which links may already point at.
   */
  private async resetSurvivingAdmin(adminId: string): Promise<void> {
    await this.usersRepository.update(
      { id: adminId },
      {
        referredById: null,
        referralPath: `${adminId}.`,
        partnerSince: null,
        bannedAt: null,
        deletedAt: null,
        avatarUrl: null,
      },
    );
    // Their wallet went with the TRUNCATE; an account without one breaks every screen
    // that reads a balance.
    await this.walletsRepository.save(
      this.walletsRepository.create({ userId: adminId, balance: '0', investCredit: '0' }),
    );
  }

  private async publicTables(): Promise<string[]> {
    const rows: Array<{ tablename: string }> = await this.dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    return rows.map((row) => row.tablename);
  }

  private async clearUploads(): Promise<number> {
    // Uploads are written relative to the working directory (see the multer destinations),
    // so that is where they have to be looked for.
    const uploadsRoot = join(process.cwd(), 'uploads');
    let removed = 0;
    for (const subdir of UPLOAD_SUBDIRS) {
      const dir = join(uploadsRoot, subdir);
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        continue; // folder was never created — nothing to clear
      }
      for (const entry of entries) {
        if (entry === '.gitkeep') continue;
        await fs.rm(join(dir, entry), { recursive: true, force: true });
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * The password lives in the environment, never in the repository — this is the one
   * secret standing between a stolen admin token and an empty platform, and a value
   * committed to git is a value anyone with the clone already has.
   */
  private assertPassword(supplied: string): void {
    const expected = this.config.get<string>('ADMIN_WIPE_PASSWORD');
    if (!expected) {
      throw new ServiceUnavailableException(
        'ADMIN_WIPE_PASSWORD is not configured on this server',
      );
    }
    // Hashed first so the comparison is over two equal-length buffers whatever was typed,
    // and so the number of bytes compared says nothing about the real password's length.
    const a = createHash('sha256').update(supplied).digest();
    const b = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(a, b)) {
      throw new ForbiddenException('Wrong wipe password');
    }
  }
}
