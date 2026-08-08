import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The key every session token on the platform is signed with.
 *
 * It used to be read as `config.get('JWT_SECRET', 'dev-secret-change-me')` in two separate
 * places, and a default is the whole problem: a deploy that forgets the variable does not
 * fail, it comes up signing tokens with a string that is written in this repository. Anyone
 * who has read the source can then mint a token for any user id — including an admin's —
 * and the API has no way to tell it from a real one. A missing secret has to be a boot
 * failure, because the alternative is an API that looks healthy and is wide open.
 *
 * Development is a different matter: there is nothing to steal and no deploy to forget, so
 * a fixed local key stays, loudly.
 */

export const DEV_JWT_SECRET = 'dev-secret-change-me';

// Not a cryptographic threshold, just a floor low enough that nobody's existing deployment
// stops booting over it and high enough to notice a secret somebody typed by hand.
const ADVISED_LENGTH = 32;

export function resolveJwtSecret(config: ConfigService): string {
  const logger = new Logger('JwtSecret');
  const secret = config.get<string>('JWT_SECRET')?.trim();
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  if (!secret || secret === DEV_JWT_SECRET) {
    if (isProduction) {
      throw new Error(
        'JWT_SECRET is missing or still the development default. Set it to a long random ' +
          'value in the environment — every session token is signed with it.',
      );
    }
    logger.warn('JWT_SECRET is not set — signing tokens with the development key');
    return DEV_JWT_SECRET;
  }

  if (secret.length < ADVISED_LENGTH) {
    // A warning rather than a refusal: a short secret is weak, but an existing deployment
    // that boots today must not stop booting because of a length check.
    logger.warn(`JWT_SECRET is shorter than ${ADVISED_LENGTH} characters — consider a longer one`);
  }
  return secret;
}
