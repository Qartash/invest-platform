import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, ThemeColors, typography, useThemeStyles } from '../../../theme';

export interface ChecklistRow {
  /** Step index this row reports on — tapping the row jumps straight there. */
  step: number;
  title: string;
  subtitle: string;
  ok: boolean;
}

interface Props {
  rows: ChecklistRow[];
  onJump: (step: number) => void;
}

/**
 * The form's errors, gathered in one place and made navigable. The old screen dumped every
 * problem at the bottom on submit and left the founder to hunt for the field; here each
 * problem is a row that takes them to it.
 */
export function ReviewChecklist({ rows, onJump }: Props) {
  const styles = useThemeStyles(createStyles);
  return (
    <View>
      {rows.map((row, index) => (
        <Pressable
          key={row.step}
          onPress={() => onJump(row.step)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, index === rows.length - 1 && styles.rowLast, pressed && styles.pressed]}
        >
          <Text style={[styles.icon, row.ok ? styles.iconOk : styles.iconBad]}>{row.ok ? '✓' : '✕'}</Text>
          <View style={styles.text}>
            <Text style={styles.title}>{row.title}</Text>
            <Text style={[styles.subtitle, !row.ok && styles.subtitleBad]}>{row.subtitle}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 2,
      paddingVertical: spacing.sm + 3,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    pressed: {
      opacity: 0.6,
    },
    icon: {
      ...typography.captionStrong,
      width: 20,
      textAlign: 'center',
    },
    iconOk: {
      color: c.success,
    },
    iconBad: {
      color: c.danger,
    },
    text: {
      flex: 1,
    },
    title: {
      ...typography.labelStrong,
      color: c.text,
    },
    subtitle: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: 1,
    },
    subtitleBad: {
      color: c.danger,
    },
    chevron: {
      ...typography.subheading,
      color: c.textMuted,
    },
  });
