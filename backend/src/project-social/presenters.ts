import { User } from '../users/entities/user.entity';
import { maskName } from '../users/investor-profile';

/**
 * The author block every question, answer and post carries.
 *
 * A null user is not an error: `onDelete: SET NULL` is what happens when an
 * account goes, and the thread it wrote in stays. The app renders that as a
 * deleted user, which is the honest description — the words are still part of
 * the project's record, the person is not.
 *
 * The name is masked here, at read time, from the author's current setting.
 * Doing it at write time would freeze whatever they had chosen that day, and
 * turning "show my full name" off later would leave the old questions naming
 * them anyway.
 */
export function toAuthor(user: User | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.showFullName ? user.fullName : maskName(user.fullName),
    avatarUrl: user.avatarUrl,
    avatarEmoji: user.avatarEmoji,
    role: user.role,
  };
}
