import { ConfigService } from '@nestjs/config';
import { DEV_JWT_SECRET, resolveJwtSecret } from './jwt-secret';

// A stand-in for ConfigService that answers from a plain object, so each case is one map
// of environment variables and nothing else.
function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveJwtSecret', () => {
  it('uses the configured secret', () => {
    const secret = 'a'.repeat(48);
    expect(resolveJwtSecret(config({ JWT_SECRET: secret, NODE_ENV: 'production' }))).toBe(secret);
  });

  // The case the whole function exists for: a production deploy that forgot the variable
  // used to come up signing tokens with a string published in this repository, which is a
  // valid admin token for anybody who has read it.
  it('refuses to boot in production without a secret', () => {
    expect(() => resolveJwtSecret(config({ NODE_ENV: 'production' }))).toThrow(/JWT_SECRET/);
  });

  it('refuses to boot in production on the development default', () => {
    expect(() => resolveJwtSecret(config({ JWT_SECRET: DEV_JWT_SECRET, NODE_ENV: 'production' }))).toThrow(
      /JWT_SECRET/,
    );
  });

  it('falls back to the development key outside production', () => {
    expect(resolveJwtSecret(config({ NODE_ENV: 'development' }))).toBe(DEV_JWT_SECRET);
  });

  // Short is weak, not fatal: an existing deployment that boots today has to keep booting.
  it('accepts a short secret with a warning', () => {
    expect(resolveJwtSecret(config({ JWT_SECRET: 'short', NODE_ENV: 'production' }))).toBe('short');
  });
});
