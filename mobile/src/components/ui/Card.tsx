import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { focusRing, PressableState, radius, spacing, ThemeColors, useThemeStyles } from '../../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  /** Draws the accent border used to mark a card as the viewer's own / active. */
  accented?: boolean;
  /** Drops the inner padding for cards that host their own edge-to-edge rows. */
  flush?: boolean;
  style?: ViewStyle;
}

export function Card({ children, onPress, accented, flush, style }: Props) {
  const styles = useThemeStyles(createStyles);
  const content = [styles.card, accented && styles.accented, flush && styles.flush, style];

  if (!onPress) return <View style={content}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered, focused }: PressableState) => [
        ...content,
        hovered && !pressed && styles.hovered,
        pressed && styles.pressed,
        focused && styles.focused,
      ]}
    >
      {children}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    accented: {
      borderColor: c.primary,
    },
    flush: {
      padding: 0,
      overflow: 'hidden',
    },
    // A hovered card lifts by taking the accent border, the same cue as a selected card —
    // it reads as "this whole surface is a button" without moving anything.
    hovered: {
      borderColor: c.primary,
    },
    pressed: {
      opacity: 0.75,
    },
    focused: focusRing(c),
  });
