import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, ThemeColors, typography, useThemeStyles } from '../theme';

interface Props {
  onRetry: () => void;
}

// Several screens swallowed a failed request into an empty list —
// `.catch(() => setQuests([]))` — so a backend that was down looked exactly like a
// backend with nothing to show. During the 27.07 run the quests screen sat at
// "streak 0 / 7" with an empty platform section while every request behind it had
// died on ERR_CONNECTION_REFUSED, offering neither an explanation nor a way to try
// again.
//
// An empty list is a fact about the data. A failed request is a fact about the
// request, and only one of the two is worth a retry button.
export function LoadFailed({ onRetry }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();

  return (
    <View style={styles.box}>
      <Text style={styles.text}>{t('common.loadFailed')}</Text>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    text: {
      ...typography.body,
      color: c.textMuted,
      textAlign: 'center',
    },
    button: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
    },
    buttonText: {
      color: c.primary,
      fontWeight: '700',
    },
  });
