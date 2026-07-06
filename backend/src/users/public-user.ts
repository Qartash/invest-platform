import { User } from './entities/user.entity';

export function toPublicUser(user: User) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
