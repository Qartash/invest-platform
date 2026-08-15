import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { Icon } from './ui/Icon';

type FieldFormat = 'integer' | 'decimal' | 'date';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  format?: FieldFormat;
  onHintPress?: () => void;
  // Renders an eye toggle inside the field and takes over `secureTextEntry`.
  // Typing a password blind is the main reason sign-in attempts fail.
  secureToggle?: boolean;
}

const FORMAT_FILTERS: Record<FieldFormat, RegExp> = {
  integer: /[^0-9]/g,
  decimal: /[^0-9.]/g,
  date: /[^0-9-]/g,
};

export function TextField({
  label,
  hint,
  error,
  format,
  onHintPress,
  secureToggle,
  style,
  onChangeText,
  ...rest
}: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const handleChangeText = (text: string) => {
    if (!onChangeText) return;
    onChangeText(format ? text.replace(FORMAT_FILTERS[format], '') : text);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onHintPress && (
          <Pressable hitSlop={10} onPress={onHintPress} style={styles.hintButton}>
            <Text style={styles.hintIcon}>ⓘ</Text>
          </Pressable>
        )}
      </View>
      <View>
        <TextInput
          style={[styles.input, secureToggle && styles.inputWithAffix, error && styles.inputError, style]}
          placeholderTextColor={colors.textMuted}
          onChangeText={onChangeText ? handleChangeText : undefined}
          {...rest}
          secureTextEntry={secureToggle ? !revealed : rest.secureTextEntry}
        />
        {secureToggle && (
          <Pressable hitSlop={8} onPress={() => setRevealed((v) => !v)} style={styles.affix}>
            <Icon name={revealed ? 'eyeOff' : 'eye'} color={colors.textMuted} size={20} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    label: {
      fontSize: 14,
      color: c.textMuted,
    },
    hintButton: {
      marginLeft: spacing.xs,
      padding: 2,
    },
    hintIcon: {
      fontSize: 13,
      color: c.textMuted,
      fontWeight: '700',
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      backgroundColor: c.surface,
      color: c.text,
    },
    inputWithAffix: {
      paddingRight: spacing.xl + spacing.sm,
    },
    affix: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: spacing.xl + spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: spacing.xs,
    },
    inputError: {
      borderColor: c.danger,
    },
    errorText: {
      fontSize: 12,
      color: c.danger,
      marginTop: spacing.xs,
    },
  });
