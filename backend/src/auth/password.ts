import * as bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

// Accounts created before hashing landed hold the password in clear text. The
// bcrypt prefix tells the two apart so those users can still log in, and
// `login()` re-hashes them on the way through.
// TODO: drop the plaintext branch once every row is upgraded (before prod).
export function isHashed(stored: string | null): boolean {
  return !!stored && /^\$2[aby]\$/.test(stored);
}

// `stored` is null on Google-only accounts: there is no password to match, so
// the password form must always reject them rather than treat null as empty.
export function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    return Promise.resolve(false);
  }
  if (!isHashed(stored)) {
    return Promise.resolve(stored === plain);
  }
  return bcrypt.compare(plain, stored);
}
