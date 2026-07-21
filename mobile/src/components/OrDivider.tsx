import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, ThemeColors, typography, useThemeStyles } from '../theme';

export function OrDivider({ label }: { label: string }) {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.row}>
      <View style={styles.rule} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginVertical: spacing.lg,
    },
    rule: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },
    label: {
      ...typography.microStrong,
      fontWeight: '600',
      color: c.textMuted,
    },
  });
