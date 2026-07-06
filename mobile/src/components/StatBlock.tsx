import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  icon: string;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  onPress?: () => void;
  onHintPress?: () => void;
  onNotePress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function StatBlock({ icon, label, value, note, onPress, onHintPress, onNotePress, disabled, style }: Props) {
  const clickable = !!onPress && !disabled;

  const body = (
    <View style={[styles.card, clickable && styles.cardClickable, style]}>
      <View style={styles.topRow}>
        <Text style={styles.icon}>{icon}</Text>
        {onHintPress && (
          <Pressable hitSlop={10} onPress={onHintPress} style={styles.hintButton}>
            <Text style={styles.hintIcon}>ⓘ</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, clickable && styles.valueClickable]} numberOfLines={1}>
          {value}
        </Text>
        {clickable && <Text style={styles.chevron}>›</Text>}
      </View>
      {note &&
        (onNotePress ? (
          <Pressable
            hitSlop={10}
            onPress={onNotePress}
            style={({ pressed }) => [styles.noteTouchable, pressed && styles.pressed]}
          >
            <Text style={[styles.note, styles.noteLink]} numberOfLines={1}>
              {note}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.note, styles.noteStandalone]} numberOfLines={1}>
            {note}
          </Text>
        ))}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => pressed && !disabled && styles.pressed}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  cardClickable: {
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
  },
  hintButton: {
    padding: 2,
  },
  hintIcon: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  valueClickable: {
    color: colors.primary,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  note: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  noteStandalone: {
    marginTop: spacing.xs,
  },
  noteLink: {
    textDecorationLine: 'underline',
  },
  noteTouchable: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
