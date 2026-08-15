import { useMemo } from 'react';
import { useBreakpoint } from '../../theme';

export interface GridColumnCounts {
  /** Phone. One column unless a screen has a reason to say otherwise. */
  compact?: number;
  medium: number;
  wide: number;
}

/**
 * Turns a list into a grid on wider windows.
 *
 * A `FlatList` given `numColumns` lays each row out as a flex row, which means a final row
 * holding fewer items than the rest lets them stretch to fill it — the last card comes out
 * two or three times the width of every card above it. The fix is to hand the list enough
 * items to square off the last row, so `data` comes back padded with `null`s that the
 * caller renders as empty cells.
 *
 * `columns` is also the value to pass as the list's `key`: React Native cannot change
 * `numColumns` on an existing list and says so at runtime, so the list has to be a new
 * element when the count changes.
 */
export function useGrid<T>(items: T[], counts: GridColumnCounts) {
  const { isCompact, isMedium } = useBreakpoint();
  const columns = isCompact ? (counts.compact ?? 1) : isMedium ? counts.medium : counts.wide;

  const data = useMemo<(T | null)[]>(() => {
    if (columns < 2) return items;
    const remainder = items.length % columns;
    if (remainder === 0) return items;
    return [...items, ...new Array<null>(columns - remainder).fill(null)];
  }, [items, columns]);

  return { columns, data, isGrid: columns > 1 };
}
