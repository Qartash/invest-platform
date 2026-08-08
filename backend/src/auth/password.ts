import * as bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Whether a stored value is a bcrypt hash rather than something else.
 *
 * Kept because `login` still needs to tell a hash from a row that predates hashing — but
 * those rows are now refused rather than accepted, see below.
 */
export function isHashed(stored: string | null): boolean {
  return !!stored && /^\$2[aby]\$/.test(stored);
}

/**
 * Checks a typed password against what is stored.
 *
 * There used to be a second branch here: if the stored value did not look like a hash it was
 * compared with `stored === plain`, so that accounts predating hashing could still sign in
 * and be upgraded on the way through. Two things were wrong with it. It meant the database
 * held readable passwords, and a database is exactly the thing that leaks — into a backup,
 * a screenshot, an admin panel, a support ticket — and people reuse passwords, so what
 * leaks is not only an account here. And `===` on strings returns as soon as two characters
 * differ, which is a timing signal a patient caller can read one character at a time; bcrypt
 * compares in constant time for that reason.
 *
 * So a non-hash never matches now. The effect on anyone still holding such a row is that the
 * password form refuses them and they come back through a reset — which is the correct
 * outcome for a credential that was stored in the clear.
 *
 * `stored` is also null on Google-only accounts: there is no password to match, so the
 * password form must always reject them rather than treat null as empty.
 */
export function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!isHashed(stored)) {
    return Promise.resolve(false);
  }
  return bcrypt.compare(plain, stored as string);
}
