import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { radius, spacing, ThemeColors, typography, useThemeStyles } from '../../theme';

// Semantic tones are deliberately separate from the brand accent: `primary` marks
// something as ours/active, while success/warning/danger encode state.
export type PillTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

interface Props {
  label: string;
  tone?: PillTone;
  style?: TextStyle;
}

export function Pill({ label, tone = 'neutral', style }: Props) {
  const styles = useThemeStyles(createStyles);
  return <Text style={[styles.base, styles[tone], style]}>{label}</Text>;
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: {
      ...typography.microStrong,
      alignSelf: 'flex-start',
      overflow: 'hidden',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    primary: { backgroundColor: c.primarySoft, color: c.primary },
    success: { backgroundColor: c.successSoft, color: c.success },
    warning: { backgroundColor: c.warningSoft, color: c.warning },
    danger: { backgroundColor: c.dangerSoft, color: c.danger },
    neutral: { backgroundColor: c.surfaceSunken, color: c.textMuted },
  });
