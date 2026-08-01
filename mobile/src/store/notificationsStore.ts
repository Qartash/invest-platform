import { create } from 'zustand';
import { fetchUnreadCount } from '../api/notifications';

/**
 * Just the badge number.
 *
 * It lives in a store rather than in the bell because two different things move
 * it: the bell asks the server how many are unread, and the notifications screen
 * knows the answer already every time it marks something read. Without somewhere
 * shared to put it, opening the screen would clear the list and leave the badge
 * on the previous count until the next poll.
 *
 * The list itself is not kept here — it belongs to the screen that shows it, and
 * useCachedQuery already holds it between visits.
 */
interface NotificationsState {
  unread: number;
  setUnread: (count: number) => void;
  refreshUnread: () => Promise<void>;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  unread: 0,
  setUnread: (count) => set({ unread: Math.max(0, count) }),
  // Best-effort: a badge that failed to refresh keeps its last value, which is a
  // far better answer than a zero that says "nothing happened".
  refreshUnread: async () => {
    try {
      set({ unread: await fetchUnreadCount() });
    } catch {
      /* leave the previous count in place */
    }
  },
  // Belongs to sign-out, next to clearQueryCache: the count carries no user in
  // it, so without this the next person to sign in inherits the last one's badge.
  reset: () => set({ unread: 0 }),
}));
