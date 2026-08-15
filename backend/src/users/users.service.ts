import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../common/enums';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { hashPassword } from '../auth/password';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  // The login form takes one field for both, so an identifier may be either.
  // Both columns are nullable, and an empty identifier would otherwise match
  // every row whose column is NULL — hence the guard.
  findByUsernameOrEmail(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    if (!value) {
      return Promise.resolve(null);
    }
    return this.usersRepository.findOne({
      where: [{ username: value }, { email: value.toLowerCase() }],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  // Ambiguous glyphs (0/O, 1/I) are dropped so a code read aloud or off a screen
  // can't be mistyped.
  private static readonly CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // A shareable code like "ARTUR-4K9": a readable stem from the handle plus a
  // random tail, retried until the tail lands on a free one.
  async generateUniqueReferralCode(seed: string): Promise<string> {
    const stem = (seed || 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'USER';
    const { CODE_ALPHABET } = UsersService;
    for (;;) {
      const tail = Array.from(
        { length: 4 },
        () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
      ).join('');
      const code = `${stem}-${tail}`;
      if (!(await this.usersRepository.findOne({ where: { referralCode: code } }))) {
        return code;
      }
    }
  }

  /**
   * True when there is not a single account yet — a brand-new database, before anyone has
   * signed up. The sign-up path uses it to let the very first account in: registration is
   * invite-only, and on an empty platform there is nobody to be invited by.
   */
  async isEmpty(): Promise<boolean> {
    return (await this.usersRepository.count()) === 0;
  }

  findByReferralCode(code: string): Promise<User | null> {
    const value = code.trim().toUpperCase();
    if (!value) return Promise.resolve(null);
    return this.usersRepository.findOne({ where: { referralCode: value } });
  }

  async create(data: {
    username: string;
    email?: string;
    passwordHash: string | null;
    googleId?: string;
    fullName?: string;
    role: UserRole;
    languagePref?: string;
    avatarEmoji?: string;
    // Who referred this account, and that referrer's own materialised path — used
    // to extend the tree. `referrerPath` is not a column; it only seeds this row's
    // path once the new id is known.
    referredById?: string | null;
    referrerPath?: string | null;
  }): Promise<User> {
    const { referrerPath, ...columns } = data;
    const referralCode = await this.generateUniqueReferralCode(columns.username);
    const saved = await this.usersRepository.save(this.usersRepository.create({ ...columns, referralCode }));

    // The path can only be built after the insert hands us the id. A root account
    // (no referrer) starts a path of just itself.
    const referralPath = `${referrerPath ?? ''}${saved.id}.`;
    await this.usersRepository.update(saved.id, { referralPath });
    saved.referralPath = referralPath;
    return saved;
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        User,
        | 'fullName'
        | 'username'
        | 'email'
        | 'phone'
        | 'telegram'
        | 'birthDate'
        | 'languagePref'
        | 'gender'
        | 'bio'
        | 'occupation'
        | 'linkedin'
        | 'shareContactsPublicly'
        | 'showFullName'
        | 'avatarEmoji'
      >
    >,
  ): Promise<User | null> {
    // Username/email are unique — reject a clash before hitting the DB constraint.
    if (data.username) {
      const taken = await this.usersRepository.findOne({ where: { username: data.username, id: Not(id) } });
      if (taken) throw new ConflictException('Username already taken');
    }
    if (data.email) {
      const taken = await this.usersRepository.findOne({ where: { email: data.email, id: Not(id) } });
      if (taken) throw new ConflictException('Email already taken');
    }
    const update = data.avatarEmoji ? { ...data, avatarUrl: null } : data;
    await this.usersRepository.update(id, update);
    return this.usersRepository.findOneBy({ id });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { passwordHash });
  }

  async linkGoogleAccount(id: string, googleId: string): Promise<void> {
    await this.usersRepository.update(id, { googleId });
  }

  async setAvatar(id: string, avatarUrl: string): Promise<User | null> {
    await this.usersRepository.update(id, { avatarUrl, avatarEmoji: null });
    return this.usersRepository.findOneBy({ id });
  }

  findAllForModeration(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  // Moderation may edit anyone but yourself — including other admins, so a
  // wrongly-promoted admin can be demoted. Self-moderation is still blocked.
  private async findModerationTarget(id: string, actingAdminId: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.id === actingAdminId) {
      throw new BadRequestException('Use your own profile settings instead');
    }
    return user;
  }

  async adminUpdate(id: string, dto: AdminUpdateUserDto, actingAdminId: string): Promise<User> {
    const user = await this.findModerationTarget(id, actingAdminId);

    if (dto.username && dto.username !== user.username) {
      const taken = await this.usersRepository.findOne({ where: { username: dto.username, id: Not(id) } });
      if (taken) throw new ConflictException('Username already taken');
    }
    if (dto.email && dto.email !== user.email) {
      const taken = await this.usersRepository.findOne({ where: { email: dto.email, id: Not(id) } });
      if (taken) throw new ConflictException('Email already taken');
    }

    // password isn't a column — map it onto the hash and drop it before assign.
    const { password, ...rest } = dto;
    Object.assign(user, rest);
    if (password) {
      user.passwordHash = await hashPassword(password);
    }
    const saved = await this.usersRepository.save(user);
    // Somebody else changed the details this account signs in with. Which fields
    // moved, never their values — a notification is not the place to restate an
    // email address or hint at a password.
    await this.notifications.notify({
      userId: saved.id,
      type: NotificationType.ACCOUNT_EDITED_BY_ADMIN,
      payload: { fields: Object.keys(rest).concat(password ? ['password'] : []) },
    });
    return saved;
  }

  async setBanned(id: string, banned: boolean, actingAdminId: string): Promise<User> {
    const user = await this.findModerationTarget(id, actingAdminId);
    user.bannedAt = banned ? new Date() : null;
    const saved = await this.usersRepository.save(user);
    // A banned account can still sign in far enough to read this — being told is
    // the difference between a ban and the app appearing to break.
    await this.notifications.notify({
      userId: saved.id,
      type: banned ? NotificationType.ACCOUNT_BANNED : NotificationType.ACCOUNT_UNBANNED,
    });
    return saved;
  }

  async setDeleted(id: string, deleted: boolean, actingAdminId: string): Promise<User> {
    const user = await this.findModerationTarget(id, actingAdminId);
    user.deletedAt = deleted ? new Date() : null;
    const saved = await this.usersRepository.save(user);
    await this.notifications.notify({
      userId: saved.id,
      type: deleted ? NotificationType.ACCOUNT_DELETED : NotificationType.ACCOUNT_RESTORED,
    });
    return saved;
  }
}
