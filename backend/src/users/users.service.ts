import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../common/enums';

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
}
