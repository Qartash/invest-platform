import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';
import { logEvent } from '../utils/logger';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  // 'small' is for buttons sitting inline next to other content (e.g. a listing row) rather
  // than spanning the full width of their container — the default size's padding was tuned
  // for full-width CTAs and looks oversized/misshapen when the button shrinks to fit its text.
  size?: 'default' | 'small';
}

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary', size = 'default' }: Props) {
  const isOutline = variant === 'outline';
  const isSmall = size === 'small';
  const handlePress = () => {
    logEvent('click', title, { component: 'PrimaryButton', variant });
    onPress();
  };
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSmall && styles.small,
        isOutline ? styles.outline : styles.filled,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, isSmall && styles.textSmall, isOutline && styles.outlineText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  filled: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 14,
  },
  outlineText: {
    color: colors.primary,
  },
});
