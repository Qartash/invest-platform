import { Platform } from 'react-native';

/**
 * The origin to build shareable links against.
 *
 * On the web this is wherever the app is actually being served from, read at call time.
 * That is the whole point: an invite copied on the Render test build has to carry the
 * Render host, the same code on the production domain has to carry that one, and neither
 * should need a constant edited or an environment variable set to be correct. A hardcoded
 * domain is a link that works everywhere except where it was made.
 *
 * Native has no origin to read, so there it falls back to the configured public URL —
 * that build ships against one known deployment anyway.
 */
export function appOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_APP_URL ?? 'https://invest.am';
}

/** The bare invite link: `<origin>/i/CODE`. */
export function inviteLink(code: string): string {
  return `${appOrigin()}/i/${code}`;
}

/**
 * An invite that opens a specific project. The path is the app's real project route, so a
 * signed-in recipient lands on the project itself; `i` is consumed at startup and still
 * attributes the sign-up of a signed-out one.
 */
export function projectInviteLink(projectId: string, code: string): string {
  return `${appOrigin()}/projects/${projectId}?i=${code}`;
}
