import { create } from 'zustand';
import { Platform } from 'react-native';

interface ReferralState {
  // The invite code the user arrived with — from a shared link or typed by hand —
  // held until registration consumes it. Not persisted: an invite is for this
  // sign-up, not forever.
  pendingCode: string | null;
  // The project an invite pointed at, when it pointed at one. A signed-out invitee has to
  // be sent to sign-up, which loses the project from the address bar — this is what gets
  // them there afterwards instead of dropping them on a generic feed.
  pendingProjectId: string | null;
  setPendingCode: (code: string | null) => void;
  setPendingProjectId: (projectId: string | null) => void;
  clearPendingCode: () => void;
  clearPendingProjectId: () => void;
}

export const useReferralStore = create<ReferralState>((set) => ({
  pendingCode: null,
  pendingProjectId: null,
  setPendingCode: (code) => set({ pendingCode: code ? code.trim().toUpperCase() : null }),
  setPendingProjectId: (projectId) => set({ pendingProjectId: projectId }),
  clearPendingCode: () => set({ pendingCode: null }),
  clearPendingProjectId: () => set({ pendingProjectId: null }),
}));

/**
 * On the web build, pulls an invite code out of the address before the navigator
 * reads it. Two shapes are accepted, because an invite is shared in two ways:
 *
 *   /i/CODE                     — the plain invite link; there is no screen at
 *                                 that path, so it is rewritten to sign-up.
 *   /projects/123?i=CODE        — an invite into a specific project. The path is
 *                                 a real route and is kept exactly as it is; only
 *                                 the `i` parameter is consumed, so a signed-in
 *                                 visitor lands on the project itself and a
 *                                 signed-out one gets sign-up with the code ready
 *                                 and the project waiting behind it.
 *
 * Web only: native has no such URL, and there the code is typed by hand.
 */
export function captureInviteFromUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;

  const bare = pathname.match(/^\/i\/([^/?#]+)/i);
  if (bare) {
    useReferralStore.getState().setPendingCode(decodeURIComponent(bare[1]));
    // Nothing is mapped to /i/, so send the browser to the screen that consumes
    // the code. Replacing (not pushing) also stops a reload re-running this.
    window.history.replaceState(null, '', '/register');
    return;
  }

  const params = new URLSearchParams(search);
  const code = params.get('i');
  if (!code) return;
  useReferralStore.getState().setPendingCode(code);
  // Remember which project this invite was into, if any. A signed-in visitor reaches it
  // from the URL alone and never needs this; a signed-out one is about to be moved to
  // sign-up, and without it the project they were invited to would simply be gone.
  const project = pathname.match(/^\/projects\/([^/?#]+)/i);
  if (project) {
    useReferralStore.getState().setPendingProjectId(decodeURIComponent(project[1]));
  }
  // Strip only `i`, keeping the route and any other query the screen relies on.
  params.delete('i');
  const rest = params.toString();
  window.history.replaceState(null, '', `${pathname}${rest ? `?${rest}` : ''}${hash}`);
}
