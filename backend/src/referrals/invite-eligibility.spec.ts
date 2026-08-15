import { UserRole } from '../common/enums';
import { INVITE_MIN_ACCOUNT_AGE_DAYS, inviteEligibility } from './invite-eligibility';

const NOW = new Date('2026-07-30T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const base = {
  role: UserRole.INVESTOR,
  partnerSince: null,
  createdAt: daysAgo(30),
  hasDeposited: true,
  now: NOW,
};

describe('inviteEligibility', () => {
  it('lets an old account that has deposited invite', () => {
    expect(inviteEligibility(base)).toMatchObject({ canInvite: true, exempt: false, daysUntilOldEnough: 0 });
  });

  it('refuses an account that has never deposited, however old', () => {
    expect(inviteEligibility({ ...base, createdAt: daysAgo(400), hasDeposited: false })).toMatchObject({
      canInvite: false,
      hasDeposited: false,
    });
  });

  it('refuses a funded account that is too new, and says how long is left', () => {
    expect(inviteEligibility({ ...base, createdAt: daysAgo(2) })).toMatchObject({
      canInvite: false,
      accountAgeDays: 2,
      daysUntilOldEnough: 5,
    });
  });

  it('counts whole days only — the seventh day does not qualify until it is complete', () => {
    const almost = new Date(NOW.getTime() - (INVITE_MIN_ACCOUNT_AGE_DAYS * 24 - 1) * 60 * 60 * 1000);
    expect(inviteEligibility({ ...base, createdAt: almost })).toMatchObject({
      canInvite: false,
      accountAgeDays: 6,
      daysUntilOldEnough: 1,
    });
    expect(inviteEligibility({ ...base, createdAt: daysAgo(INVITE_MIN_ACCOUNT_AGE_DAYS) })).toMatchObject({
      canInvite: true,
      accountAgeDays: 7,
    });
  });

  // Without this the platform cannot be opened at all: a wipe leaves one admin, aged zero
  // and holding nothing, and registration is closed to anyone without a working code.
  it('exempts an admin created seconds ago with an empty wallet', () => {
    expect(
      inviteEligibility({ ...base, role: UserRole.ADMIN, createdAt: NOW, hasDeposited: false }),
    ).toMatchObject({ canInvite: true, exempt: true });
  });

  it('exempts an approved partner who has not deposited', () => {
    expect(
      inviteEligibility({ ...base, partnerSince: daysAgo(1), createdAt: daysAgo(1), hasDeposited: false }),
    ).toMatchObject({ canInvite: true, exempt: true });
  });

  it('never reports a negative age for a clock that disagrees with the database', () => {
    expect(inviteEligibility({ ...base, createdAt: new Date(NOW.getTime() + 60_000) })).toMatchObject({
      accountAgeDays: 0,
      daysUntilOldEnough: INVITE_MIN_ACCOUNT_AGE_DAYS,
    });
  });
});
