import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TourId } from './types';

interface ActiveTour {
  tour: TourId;
  index: number;
}

interface TourState {
  /** The welcome slides have been seen (or skipped). Gates every tour behind them. */
  seenIntro: boolean;
  /** Tours that ran to the last step, or were dismissed. Either way, don't offer again. */
  completed: Partial<Record<TourId, boolean>>;
  active: ActiveTour | null;
  /** Persisted state has been read back. Nothing may auto-start before this is true. */
  hydrated: boolean;

  markIntroSeen: () => void;
  /**
   * The slides were dismissed rather than read. That is an answer about the walkthrough too,
   * so the investor tour it leads into is retired with them — the role-specific tours still
   * offer themselves later, and the guide is always there.
   */
  skipIntro: () => void;
  startTour: (tour: TourId) => void;
  /** Starts a tour only if this person has never finished or dismissed it. */
  startTourOnce: (tour: TourId) => void;
  next: (total: number) => void;
  prev: () => void;
  /** Leaves the tour and records it as done — "skip" and "finish" mean the same thing here. */
  end: () => void;
  /** Puts onboarding back to a first-run state, for the "start over" control in the guide. */
  resetAll: () => void;
  setHydrated: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      seenIntro: false,
      completed: {},
      active: null,
      hydrated: false,

      markIntroSeen: () => set({ seenIntro: true }),

      skipIntro: () => set((s) => ({ seenIntro: true, completed: { ...s.completed, investor: true } })),

      startTour: (tour) => set({ active: { tour, index: 0 } }),

      startTourOnce: (tour) => {
        const { completed, active, seenIntro, hydrated } = get();
        if (!hydrated || !seenIntro || active || completed[tour]) return;
        set({ active: { tour, index: 0 } });
      },

      next: (total) => {
        const { active, completed } = get();
        if (!active) return;
        const index = active.index + 1;
        if (index >= total) {
          set({ active: null, completed: { ...completed, [active.tour]: true } });
          return;
        }
        set({ active: { ...active, index } });
      },

      prev: () => {
        const { active } = get();
        if (!active) return;
        set({ active: { ...active, index: Math.max(0, active.index - 1) } });
      },

      end: () => {
        const { active, completed } = get();
        if (!active) return;
        set({ active: null, completed: { ...completed, [active.tour]: true } });
      },

      resetAll: () => set({ seenIntro: false, completed: {}, active: null }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // `active` is deliberately absent: a tour interrupted by closing the app should not
      // reopen as an overlay over a cold start. The completion flags are the durable part.
      partialize: (s) => ({ seenIntro: s.seenIntro, completed: s.completed }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
