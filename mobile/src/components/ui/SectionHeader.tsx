import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, ThemeColors, typography, useThemeStyles } from '../../theme';

interface Props {
  title: string;
  /** Optional trailing text action, e.g. "Все ›". */
  actionLabel?: string;
  onActionPress?: () => void;
  /** Extra top room when the header opens a new stretch of content. */
  spaced?: boolean;
}

export function SectionHeader({ title, actionLabel, onActionPress, spaced }: Props) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={[styles.row, spaced && styles.spaced]}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onActionPress && (
        <Pressable hitSlop={8} onPress={onActionPress}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    spaced: {
      marginTop: spacing.lg,
    },
    title: {
      ...typography.eyebrow,
      color: c.textMuted,
    },
    action: {
      ...typography.captionStrong,
      color: c.primary,
    },
  });
