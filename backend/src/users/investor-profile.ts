import { User } from './entities/user.entity';
import { KycStatus } from '../common/enums';

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
) {
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    avatarEmoji: user.avatarEmoji,
    age: user.birthDate ? computeAge(user.birthDate) : null,
    gender: user.gender,
    verified: user.kycStatus === KycStatus.APPROVED,
    bio: user.bio,
    occupation: user.occupation,
    memberSince: user.createdAt,
    telegram: user.shareContactsPublicly ? user.telegram : null,
    linkedin: user.shareContactsPublicly ? user.linkedin : null,
    projects,
  };
}
