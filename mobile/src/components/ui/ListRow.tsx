import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  focusRing,
  PressableState,
  radius,
  spacing,
  tabularNums,
  ThemeColors,
  typography,
  useTheme,
  useThemeStyles,
} from '../../theme';
import { Icon, IconName } from './Icon';

interface RowProps {
  label: string;
  /** Secondary line under the label, for rows that need a word of explanation. */
  sublabel?: string;
  /** Right-hand text. Rendered with tabular figures so stacked rows line up. */
  value?: React.ReactNode;
  /** Replaces `value` when the right side needs a Pill, button or custom node. */
  right?: React.ReactNode;
  /**
   * Glyph shown in a tinted plaque. Only pass one where the icon carries meaning the label
   * doesn't already — a row labelled "Риск" does not need a warning sign next to it.
   */
  icon?: IconName;
  onPress?: () => void;
  onHintPress?: () => void;
}

export function ListRow({ label, sublabel, value, right, icon, onPress, onHintPress }: RowProps) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const tappable = !!onPress;
  // On a read-only row the value is the thing being read, so the label steps back. A row you
  // can tap is a destination and its label is the point — it keeps full weight even when it
  // also carries a value, otherwise "Кошелёк · 9 600 ֏" dresses up as a data row and stops
  // looking tappable at all.
  const paired = !tappable && (right !== undefined || (value !== undefined && value !== null));

  const body = (
    <>
      {icon && (
        <View style={styles.plaque}>
          <Icon name={icon} color={colors.primary} size={17} />
        </View>
      )}
      <View style={styles.labelBlock}>
        <Text style={[styles.label, paired && styles.labelPaired, tappable && styles.labelNav]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel && (
          <Text style={styles.sublabel} numberOfLines={1}>
            {sublabel}
          </Text>
        )}
      </View>
      {onHintPress && (
        <Pressable hitSlop={10} onPress={onHintPress} style={styles.hintButton}>
          <Text style={styles.hintIcon}>ⓘ</Text>
        </Pressable>
      )}
      {right ?? (value !== undefined && value !== null ? (
        <Text style={[styles.value, tappable && styles.valueTappable]} numberOfLines={1}>
          {value}
        </Text>
      ) : null)}
      {tappable && <Text style={styles.chevron}>›</Text>}
    </>
  );

  if (!tappable) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered, focused }: PressableState) => [
        styles.row,
        hovered && styles.hovered,
        pressed && styles.pressed,
        focused && styles.focused,
      ]}
    >
      {body}
    </Pressable>
  );
}

/** Groups ListRows into one bordered card with hairline dividers between them. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  const styles = useThemeStyles(createStyles);
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? styles.divided : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    group: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    divided: {
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    // Same tinted fill as the pressed state but it is the resting hover — the row lights up
    // under the cursor the way a web list is expected to.
    hovered: {
      backgroundColor: c.primarySoft,
    },
    pressed: {
      backgroundColor: c.primarySoft,
    },
    // Inset so the ring isn't clipped by the group's `overflow: hidden`.
    focused: { ...focusRing(c), outlineOffset: -2 },
    plaque: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    labelBlock: {
      flex: 1,
    },
    label: {
      ...typography.label,
      color: c.text,
    },
    labelPaired: {
      color: c.textMuted,
    },
    // A destination carries more weight than a fact. Together with the chevron this is what
    // separates "Кошелёк ›" from "Логин — amalya" at a glance.
    labelNav: {
      fontWeight: typography.labelStrong.fontWeight,
    },
    sublabel: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: 1,
    },
    hintButton: {
      padding: 2,
    },
    hintIcon: {
      ...typography.microStrong,
      color: c.textMuted,
    },
    value: {
      ...typography.labelStrong,
      ...tabularNums,
      color: c.text,
      flexShrink: 1,
    },
    valueTappable: {
      color: c.primary,
    },
    chevron: {
      ...typography.heading,
      color: c.primary,
      marginLeft: -2,
      marginTop: -2,
    },
  });
