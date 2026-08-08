import { hashPassword, isHashed, verifyPassword } from './password';

describe('verifyPassword', () => {
  it('accepts the right password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects the wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery stapl', hash)).resolves.toBe(false);
  });

  // There used to be a branch here comparing a non-hash with `===`, so that rows predating
  // hashing could still sign in. It meant the database held readable passwords and that the
  // comparison leaked its answer through timing. A stored password that is not a hash is now
  // a password nobody can use.
  it('never matches a value stored in the clear', async () => {
    await expect(verifyPassword('hunter2', 'hunter2')).resolves.toBe(false);
  });

  // Google-only accounts have no password at all, and null must not read as an empty one.
  it('rejects an account with no password', async () => {
    await expect(verifyPassword('', null)).resolves.toBe(false);
    await expect(verifyPassword('anything', null)).resolves.toBe(false);
  });
});

describe('isHashed', () => {
  it.each(['$2a$', '$2b$', '$2y$'])('recognises the %s prefix', async (prefix) => {
    expect(isHashed(`${prefix}10$abcdefghijklmnopqrstuv`)).toBe(true);
  });

  it.each([[null], [''], ['plain'], ['$1$md5$']])('does not mistake %p for a hash', (stored) => {
    expect(isHashed(stored)).toBe(false);
  });
});
