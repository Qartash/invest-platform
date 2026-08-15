import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { focusRing, PressableState, spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../../theme';
import { Icon, IconName } from './Icon';

interface Props {
  label: string;
  icon?: IconName;
  expanded: boolean;
  onToggle: () => void;
  /** Lifts the row out of the muted tone — for a comment on a rejected project, say. */
  tone?: 'muted' | 'danger';
  children?: React.ReactNode;
}

// One quiet line at the foot of a card that says "there is more here" without spending any
// of the card's attention on it: a moderator's comment, the lots behind a merged holding.
// Both used to occupy permanent blocks; neither is read more than once.
export function DisclosureRow({ label, icon, expanded, onToggle, tone = 'muted', children }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.danger : colors.textMuted;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        style={({ pressed, hovered, focused }: PressableState) => [
          styles.row,
          (pressed || hovered) && styles.pressed,
          focused && styles.focused,
        ]}
        hitSlop={6}
      >
        {icon && <Icon name={icon} size={14} color={color} />}
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} color={color} />
      </Pressable>
      {expanded && !!children && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: spacing.sm + 2,
      paddingTop: spacing.sm + 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
    },
    pressed: {
      opacity: 0.6,
    },
    focused: focusRing(c),
    label: {
      ...typography.micro,
      flex: 1,
    },
    body: {
      marginTop: spacing.sm,
    },
  });
