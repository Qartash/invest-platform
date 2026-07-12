import { User } from './entities/user.entity';
import { KycStatus } from '../common/enums';

// Keeps first and last letter of each word, masks the middle: "Grigor
// Karamyan" -> "G••••r K••••••n". Short words stay as-is.
function maskName(name: string | null): string | null {
  if (!name) return name;
  return name
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 2) return word;
      return `${word[0]}${'•'.repeat(word.length - 2)}${word[word.length - 1]}`;
    })
    .join(' ');
}

function computeAge(birthDate: string): number {
  const dob = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function toInvestorProfile(
  user: User,
  projects: Array<{ id: string; title: unknown; coverImageUrl: string | null; status: string }>,
  // Founders can't hide: publishing a project makes the identity public.
  forcePublic = false,
) {
  // A private profile hides every personal detail from other users, not just
  // the name — bio, job, age, gender and contacts all go too.
  const hidden = !user.showFullName && !forcePublic;
  return {
    id: user.id,
    role: user.role,
    fullName: hidden ? maskName(user.fullName) : user.fullName,
    avatarUrl: user.avatarUrl,
    avatarEmoji: user.avatarEmoji,
    age: hidden ? null : user.birthDate ? computeAge(user.birthDate) : null,
    gender: hidden ? null : user.gender,
    verified: user.kycStatus === KycStatus.APPROVED,
    bio: hidden ? null : user.bio,
    occupation: hidden ? null : user.occupation,
    memberSince: user.createdAt,
    telegram: !hidden && user.shareContactsPublicly ? user.telegram : null,
    linkedin: !hidden && user.shareContactsPublicly ? user.linkedin : null,
    projects,
  };
}
