import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useTourStore } from './tourStore';
import { TourId } from './types';

/**
 * Starts a tour the first time someone looks at the screen it belongs to.
 *
 * Fires on focus rather than on mount because a tab's stack is mounted well before it is
 * looked at — without the focus check, opening the app would start the founder tour behind
 * the investor one.
 *
 * The store does the rest of the gating: nothing starts before the intro slides are done,
 * while another tour is running, or a second time.
 */
export function useAutoTour(tour: TourId, enabled = true): void {
  const isFocused = useIsFocused();
  const startTourOnce = useTourStore((s) => s.startTourOnce);
  const hydrated = useTourStore((s) => s.hydrated);
  const seenIntro = useTourStore((s) => s.seenIntro);

  useEffect(() => {
    if (!enabled || !isFocused || !hydrated || !seenIntro) return;
    startTourOnce(tour);
  }, [enabled, isFocused, hydrated, seenIntro, startTourOnce, tour]);
}
