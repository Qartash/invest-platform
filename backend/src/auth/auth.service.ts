import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums';
import { toPublicUser } from '../users/public-user';

// New accounts without a photo get a random emoji avatar so people are never
// shown a blank placeholder. Keep in sync with the mobile avatar picker list.
const DEFAULT_AVATAR_EMOJIS = ['😀', '😎', '🤓', '🦁', '🐯', '🐼', '🦊', '🐸', '🚀', '💼', '🌟', '🔥', '💎', '🏆', '🎯', '🌈'];

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Username already taken');
    }
    const user = await this.usersService.create({
      username: dto.username,
      passwordHash: dto.password,
      fullName: dto.fullName,
      role: UserRole.INVESTOR,
      languagePref: dto.languagePref ?? 'hy',
      avatarEmoji: DEFAULT_AVATAR_EMOJIS[Math.floor(Math.random() * DEFAULT_AVATAR_EMOJIS.length)],
    });
    await this.walletsService.createForUser(user.id);
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user || user.passwordHash !== dto.password || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.bannedAt) {
      throw new UnauthorizedException('Account is banned');
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
