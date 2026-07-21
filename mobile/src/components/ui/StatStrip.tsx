import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../../theme';

export interface StatItem {
  label: string;
  value: string;
  /** Tints the value — used for gains and losses, which are the only numbers that carry a sign. */
  tone?: string;
}

interface Props {
  stats: StatItem[];
  /** Closes the band with a second rule, for cards that continue below it. */
  bounded?: boolean;
}

// The band of secondary figures under a card's headline number. Shared by the founder's
// project card and the investor's holding card so both read as the same object seen from
// two sides — one row of eyebrow labels over tabular values, never more than three columns.
export function StatStrip({ stats, bounded }: Props) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={[styles.row, bounded && styles.bounded]}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Text style={styles.label} numberOfLines={1}>
            {stat.label}
          </Text>
          <Text style={[styles.value, !!stat.tone && { color: stat.tone }]} numberOfLines={1}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.sm + 2,
    },
    bounded: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingBottom: spacing.sm + 2,
    },
    stat: {
      flex: 1,
    },
    label: {
      ...typography.eyebrow,
      color: c.textMuted,
    },
    value: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.text,
      marginTop: 2,
    },
  });
