import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { breakpoints } from './tokens';

export interface Breakpoint {
  width: number;
  /** Phone layout — native and the phone browser alike. The branch that must not change. */
  isCompact: boolean;
  /** Tablet, or a desktop browser window dragged narrow. */
  isMedium: boolean;
  /** Room for a genuinely different layout: side navigation, columns, real tables. */
  isWide: boolean;
}

/**
 * The single source of truth for which layout to render.
 *
 * Built on `useWindowDimensions` rather than `Dimensions.get()`: the latter is read once and
 * never updates, which is invisible on a phone but wrong in a browser, where the window is
 * resized all the time.
 *
 * Nothing outside this hook should compare a width against a number — branch on these flags
 * so every screen agrees on where the layout changes.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();

  return useMemo(
    () => ({
      width,
      isCompact: width < breakpoints.md,
      isMedium: width >= breakpoints.md && width < breakpoints.lg,
      isWide: width >= breakpoints.lg,
    }),
    [width],
  );
}
