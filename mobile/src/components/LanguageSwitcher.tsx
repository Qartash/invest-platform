import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../i18n';
import { colors, spacing } from '../theme';

interface Props {
  compact?: boolean;
}

export function LanguageSwitcher({ compact }: Props) {
  const { i18n } = useTranslation();

  return (
    <View style={styles.row}>
      {SUPPORTED_LANGUAGES.map((language) => (
        <Pressable
          key={language}
          style={[
            styles.chip,
            compact && styles.chipCompact,
            i18n.language === language && styles.chipActive,
          ]}
          onPress={() => changeLanguage(language)}
        >
          <Text
            style={[
              styles.chipText,
              compact && styles.chipTextCompact,
              i18n.language === language && styles.chipTextActive,
            ]}
          >
            {LANGUAGE_LABELS[language]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  chipCompact: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
  },
  chipTextCompact: {
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
