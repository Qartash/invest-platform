import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';

/**
 * Bottom-anchored action panel. Sits as a sibling *after* the ScrollView, never inside it,
 * so it stays put while content scrolls behind. Pads itself for the home indicator.
 */
export function StickyBar({ children }: { children: React.ReactNode }) {
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: spacing.md + insets.bottom }]}>{children}</View>;
}

const createStyles = (c: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    bar: {
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 4,
      // Shadows are cast in black on both grounds; only the opacity changes.
      shadowColor: '#000',
      shadowOpacity: scheme === 'dark' ? 0.4 : 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -6 },
      elevation: 12,
    },
  });
