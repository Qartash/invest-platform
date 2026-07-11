import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../common/enums';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  create(data: {
    username: string;
    passwordHash: string;
    fullName?: string;
    role: UserRole;
    languagePref?: string;
  }): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(
    id: string,
    data: Partial<
      Pick<
        User,
        | 'fullName'
        | 'phone'
        | 'telegram'
        | 'birthDate'
        | 'languagePref'
        | 'gender'
        | 'bio'
        | 'occupation'
        | 'linkedin'
        | 'shareContactsPublicly'
        | 'avatarEmoji'
      >
    >,
  ): Promise<User | null> {
    const update = data.avatarEmoji ? { ...data, avatarUrl: null } : data;
    await this.usersRepository.update(id, update);
    return this.usersRepository.findOneBy({ id });
  }

  async setAvatar(id: string, avatarUrl: string): Promise<User | null> {
    await this.usersRepository.update(id, { avatarUrl, avatarEmoji: null });
    return this.usersRepository.findOneBy({ id });
  }

  findAllForModeration(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  // Moderation may edit anyone except admins — admin accounts manage themselves.
  private async findModerationTarget(id: string, actingAdminId: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.id === actingAdminId) {
      throw new BadRequestException('Use your own profile settings instead');
    }
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Admin accounts cannot be moderated');
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

    Object.assign(user, dto);
    return this.usersRepository.save(user);
  }

  async setBanned(id: string, banned: boolean, actingAdminId: string): Promise<User> {
    const user = await this.findModerationTarget(id, actingAdminId);
    user.bannedAt = banned ? new Date() : null;
    return this.usersRepository.save(user);
  }

  async setDeleted(id: string, deleted: boolean, actingAdminId: string): Promise<User> {
    const user = await this.findModerationTarget(id, actingAdminId);
    user.deletedAt = deleted ? new Date() : null;
    return this.usersRepository.save(user);
  }
}
