import { UserRole } from '../common/enums';

/**
 * Who is allowed to bring someone onto the platform.
 *
 * Registration is invite-only, so this rule is also the answer to "who may register": a
 * sign-up needs a code, and a code only works while the person it belongs to satisfies what
 * is below. The point is that an invite costs something to be able to issue — an account
 * that has put money in and has been around long enough — so the tree cannot be grown by
 * throwaway accounts inviting each other.
 *
 * Two exemptions, both load-bearing rather than convenient:
 *
 *   Admins. Without this the platform deadlocks the moment it is empty. A fresh install (or
 *   the moderation wipe) leaves one admin account, aged zero and holding nothing, whose code
 *   would not work — and with registration closed there would be no way for anyone, ever, to
 *   get in. Admins are the root the tree grows from.
 *
 *   Partners. An approved partner is someone the platform has signed up specifically to
 *   bring people in, at a higher rate paid to a card. Requiring them to deposit their own
 *   money first would disable the programme for exactly the people it was built for.
 */
export const INVITE_MIN_ACCOUNT_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InviteEligibilityInput {
  role: UserRole;
  partnerSince: Date | null;
  createdAt: Date;
  /** Whether the account has at least one completed deposit. */
  hasDeposited: boolean;
  now?: Date;
}

export interface InviteEligibility {
  /** Whether this account's code currently works as an invite. */
  canInvite: boolean;
  /** True when the account is past the rule entirely — an admin or a partner. */
  exempt: boolean;
  hasDeposited: boolean;
  /** Whole days since registration. */
  accountAgeDays: number;
  /** Whole days still to wait, 0 once the age requirement is met. */
  daysUntilOldEnough: number;
}

export function inviteEligibility(input: InviteEligibilityInput): InviteEligibility {
  const now = input.now ?? new Date();
  // Floored, so "7 days" means seven full days rather than any part of a seventh.
  const accountAgeDays = Math.max(0, Math.floor((now.getTime() - input.createdAt.getTime()) / DAY_MS));
  const daysUntilOldEnough = Math.max(0, INVITE_MIN_ACCOUNT_AGE_DAYS - accountAgeDays);
  const exempt = input.role === UserRole.ADMIN || input.partnerSince !== null;

  return {
    canInvite: exempt || (input.hasDeposited && daysUntilOldEnough === 0),
    exempt,
    hasDeposited: input.hasDeposited,
    accountAgeDays,
    daysUntilOldEnough,
  };
}
