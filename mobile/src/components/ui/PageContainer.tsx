import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { maxWidth as maxWidthTokens, useBreakpoint } from '../../theme';

interface PageContainerProps {
  children: React.ReactNode;
  /** Ceiling for the centred column. Defaults to the page reading measure. */
  maxWidth?: number;
  /** Fill the height of the parent — for a screen root, not for scroller content. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Caps and centres content that would otherwise run the full width of a desktop window.
 *
 * On a phone it renders nothing at all — not a View with the cap disabled, nothing. An extra
 * wrapper there would be layout-visible even with no styles of its own: it breaks the flex
 * chain, so a child asking for `flex: 1` stops filling the screen. Since the phone layout is
 * the one that must come out unchanged, the wrapper only appears once there is a reason for
 * it to.
 *
 * The cost is that dragging a browser window across the breakpoint changes the element type
 * at this position and so remounts the subtree, losing scroll offset and any local state.
 * That is a resize-only cost and worth paying to keep the phone tree untouched.
 */
export function PageContainer({
  children,
  maxWidth = maxWidthTokens.page,
  fill = false,
  style,
}: PageContainerProps) {
  const { isCompact } = useBreakpoint();

  if (isCompact) return <>{children}</>;

  return <View style={[styles.container, fill && styles.fill, { maxWidth }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
});
