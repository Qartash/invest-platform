import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';
import { InviteEligibilityService } from '../referrals/invite-eligibility.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { toPublicUser } from '../users/public-user';
import { hashPassword, isHashed, verifyPassword } from './password';
import { GoogleVerifier } from './google-verifier';

// New accounts without a photo get a random emoji avatar so people are never
// shown a blank placeholder. Keep in sync with the mobile avatar picker list.
const DEFAULT_AVATAR_EMOJIS = ['😀', '😎', '🤓', '🦁', '🐯', '🐼', '🦊', '🐸', '🚀', '💼', '🌟', '🔥', '💎', '🏆', '🎯', '🌈'];

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly jwtService: JwtService,
    private readonly googleVerifier: GoogleVerifier,
    private readonly inviteEligibility: InviteEligibilityService,
  ) {}

  /**
   * @param options.skipInviteCheck Creates the account without an invite. For the seeders
   * only — the demo seeder and `npm run seed` build a cast of accounts on an empty database,
   * where by definition nobody yet holds a code that works. Deliberately a parameter rather
   * than a field on RegisterDto: anything on the DTO can be sent over HTTP, and a flag that
   * turns off the invite requirement is not something a caller may ask for.
   */
  async register(dto: RegisterDto, options: { skipInviteCheck?: boolean } = {}) {
    const email = dto.email.trim().toLowerCase();
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    if (dto.username && (await this.usersService.findByUsername(dto.username))) {
      throw new ConflictException('Username already taken');
    }
    const referrer = options.skipInviteCheck
      ? await this.resolveReferrer(dto.referralCode)
      : await this.requireInviter(dto.referralCode);
    const user = await this.usersService.create({
      username: dto.username ?? (await this.deriveUsername(email)),
      email,
      passwordHash: await hashPassword(dto.password),
      fullName: dto.fullName,
      role: UserRole.INVESTOR,
      languagePref: dto.languagePref ?? 'hy',
      avatarEmoji: DEFAULT_AVATAR_EMOJIS[Math.floor(Math.random() * DEFAULT_AVATAR_EMOJIS.length)],
      referredById: referrer?.id ?? null,
      referrerPath: referrer?.referralPath ?? null,
    });
    await this.walletsService.createForUser(user.id);
    return this.buildAuthResponse(user);
  }

  /**
   * The gate on the whole platform: no working invite, no account.
   *
   * Each refusal is its own message because they are three different situations for the
   * person at the form, and one generic "invalid code" would leave all three stuck. A
   * mistyped code is theirs to fix; a code whose owner cannot yet invite is not — that one
   * has to send them back to whoever gave it to them, which is only possible if we say so.
   *
   * A banned or deleted referrer is reported as unknown rather than as ineligible: their
   * standing is nobody else's business, and the outcome is the same either way.
   */
  private async requireInviter(code: string | undefined): Promise<User | null> {
    // The one way onto a brand-new platform. Invite-only registration plus an empty users
    // table is a locked door with the key inside: nobody holds a code, so nobody can sign up,
    // so nobody ever holds a code. The first account is therefore let in without one — and
    // only the first, because the moment it exists this branch can never be taken again.
    // It is created as an ordinary investor, like any other; whoever deployed the platform
    // promotes it to admin, which is the same step they take today.
    if (await this.usersService.isEmpty()) {
      return null;
    }

    const trimmed = code?.trim();
    if (!trimmed) {
      throw new BadRequestException('An invite code is required to register');
    }
    const referrer = await this.usersService.findByReferralCode(trimmed);
    if (!referrer || referrer.bannedAt || referrer.deletedAt) {
      throw new BadRequestException('This invite code does not exist');
    }
    const eligibility = await this.inviteEligibility.forUser(referrer);
    if (!eligibility.canInvite) {
      throw new BadRequestException('This invite code is not active yet');
    }
    return referrer;
  }

  // The lenient resolution, kept for the two callers that are not a public sign-up: the
  // seeders (see register's options) and a returning Google user, whose attribution was
  // settled when their account was first created and must not be re-decided now.
  private async resolveReferrer(code: string | undefined): Promise<User | null> {
    if (!code) return null;
    const referrer = await this.usersService.findByReferralCode(code);
    if (!referrer || referrer.bannedAt || referrer.deletedAt) return null;
    return referrer;
  }

  // Google is treated as proof of the email, not as a separate identity: an
  // existing local account with that address is adopted rather than duplicated,
  // which is also what makes "sign up with Google, later log in with Google"
  // work for someone who first registered with a password.
  async loginWithGoogle(idToken: string, referralCode?: string) {
    const identity = await this.googleVerifier.verify(idToken);

    let user = await this.usersService.findByEmail(identity.email);
    if (user) {
      if (user.deletedAt) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (!user.googleId) {
        await this.usersService.linkGoogleAccount(user.id, identity.googleId);
      }
    } else {
      // No account with this address yet, so this is a sign-up wearing a sign-in's clothing
      // and the invite gate applies exactly as it does on the registration form. Without
      // this, "continue with Google" would be an open door straight past it. A returning
      // Google user never reaches here and keeps whoever first referred them.
      const referrer = await this.requireInviter(referralCode);
      user = await this.usersService.create({
        username: await this.deriveUsername(identity.email),
        email: identity.email,
        // No password: this account can only come back in through Google until
        // the user sets one.
        passwordHash: null,
        googleId: identity.googleId,
        fullName: identity.fullName,
        role: UserRole.INVESTOR,
        languagePref: 'hy',
        avatarEmoji: DEFAULT_AVATAR_EMOJIS[Math.floor(Math.random() * DEFAULT_AVATAR_EMOJIS.length)],
        referredById: referrer?.id ?? null,
        referrerPath: referrer?.referralPath ?? null,
      });
      await this.walletsService.createForUser(user.id);
    }

    if (user.bannedAt) {
      throw new UnauthorizedException('Account is banned');
    }
    return this.buildAuthResponse(user);
  }

  // Sign-up collects an email, but a username is still what the JWT, the profile
  // header and moderation search key off. Build a readable one from the local
  // part and walk a numeric suffix until it's free.
  private async deriveUsername(email: string): Promise<string> {
    const base = (email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user')
      .slice(0, 20)
      .padEnd(3, '0');
    let candidate = base;
    for (let n = 1; await this.usersService.findByUsername(candidate); n += 1) {
      candidate = `${base}${n}`;
    }
    return candidate;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsernameOrEmail(dto.username);
    if (!user || !(await verifyPassword(dto.password, user.passwordHash)) || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.bannedAt) {
      throw new UnauthorizedException('Account is banned');
    }
    // A correct password on a legacy plaintext row is the one moment we hold the
    // cleartext and know it's right — upgrade the row in place so it never
    // needs the plaintext comparison again.
    if (!isHashed(user.passwordHash)) {
      await this.usersService.setPasswordHash(user.id, await hashPassword(dto.password));
    }
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: toPublicUser(user),
    };
  }
}
