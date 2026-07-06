import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, spacing } from '../theme';

type FieldFormat = 'integer' | 'decimal' | 'date';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  format?: FieldFormat;
  onHintPress?: () => void;
}

const FORMAT_FILTERS: Record<FieldFormat, RegExp> = {
  integer: /[^0-9]/g,
  decimal: /[^0-9.]/g,
  date: /[^0-9-]/g,
};

export function TextField({ label, hint, error, format, onHintPress, style, onChangeText, ...rest }: Props) {
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
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        onChangeText={onChangeText ? handleChangeText : undefined}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.textMuted,
  },
  hintButton: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  hintIcon: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
