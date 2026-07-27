import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { focusRing, PressableState, spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
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
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
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
      style={({ pressed, hovered, focused }: PressableState) => [
        styles.base,
        isSmall && styles.small,
        isOutline ? styles.outline : styles.filled,
        // Loading keeps the button's colour — it is still the thing you just pressed.
        // Disabled drains it, because a half-opacity brand colour still reads as a
        // live button: on the moderation screen three taps in a row produced no
        // request and no message, and it looked like a broken button rather than an
        // unmet condition.
        loading && styles.dimmed,
        disabled && !loading && (isOutline ? styles.outlineDisabled : styles.filledDisabled),
        // Hover deepens the surface a touch so the button reacts to the cursor before it is
        // clicked; on a phone `hovered` never fires, so the mobile look is unchanged.
        hovered && !pressed && (isOutline ? styles.outlineHovered : styles.filledHovered),
        pressed && styles.pressed,
        focused && styles.focused,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : colors.textOnAccent} />
      ) : (
        <Text
          style={[
            styles.text,
            isSmall && styles.textSmall,
            isOutline && styles.outlineText,
            disabled && !loading && styles.textDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
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
      backgroundColor: c.primary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.primary,
    },
    dimmed: {
      opacity: 0.5,
    },
    filledDisabled: {
      backgroundColor: c.border,
    },
    outlineDisabled: {
      borderColor: c.border,
    },
    textDisabled: {
      color: c.textMuted,
    },
    filledHovered: {
      backgroundColor: c.primaryDark,
    },
    outlineHovered: {
      backgroundColor: c.primarySoft,
    },
    pressed: {
      opacity: 0.85,
    },
    focused: focusRing(c),
    text: {
      color: c.textOnAccent,
      fontSize: 16,
      fontWeight: '600',
    },
    textSmall: {
      fontSize: 14,
    },
    outlineText: {
      color: c.primary,
    },
  });
