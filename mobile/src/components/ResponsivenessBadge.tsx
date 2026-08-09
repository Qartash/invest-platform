import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './ui';
import { describeResponsiveness, ResponsivenessInput } from '../utils/responsiveness';
import { radius, spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';

interface Props {
  project: ResponsivenessInput;
  /** The card variant is one line; the header one adds the counts underneath. */
  variant?: 'chip' | 'row';
  style?: ViewStyle;
}

/**
 * The one place the questions feature pays for itself: a reader sees how a
 * founder treats questions *before* opening the project, next to the risk level
 * and the amount raised.
 *
 * A project nobody has asked shows nothing at all rather than a neutral chip —
 * an empty badge is noise on a card, and silence is not a fact about the
 * founder.
 */
export function ResponsivenessBadge({ project, variant = 'chip', style }: Props) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const badge = describeResponsiveness(project);

  if (badge.tier === 'none') return null;

  const tone = badge.tier === 'good' ? 'good' : badge.tier === 'slow' ? 'slow' : 'poor';
  const iconColor = tone === 'good' ? colors.success : tone === 'slow' ? colors.warning : colors.danger;

  return (
    <View style={[styles.wrap, styles[tone], variant === 'row' && styles.row, style]}>
      <Icon name={badge.tier === 'poor' ? 'flag' : 'comment'} size={12} color={iconColor} />
      <View style={variant === 'row' ? styles.rowText : undefined}>
        <Text style={[styles.label, { color: iconColor }]}>{summary(badge, t)}</Text>
        {variant === 'row' && (
          <Text style={styles.detail}>
            {t('social.responsiveness.detail', {
              answered: badge.answeredCount,
              total: badge.questionsCount,
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Reads as a sentence about the founder, not as a statistic. "Does not answer ·
 * 6 questions" is the version somebody acts on; "20% answered" is one they have
 * to interpret.
 */
function summary(
  badge: ReturnType<typeof describeResponsiveness>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (badge.tier === 'poor') {
    return badge.answeredCount === 0
      ? t('social.responsiveness.silent', { count: badge.unansweredCount })
      : t('social.responsiveness.patchy', { count: badge.unansweredCount });
  }
  const minutes = badge.medianMinutes ?? 0;
  if (minutes < 90) return t('social.responsiveness.fast', { count: Math.max(1, Math.round(minutes)) });
  if (minutes < 24 * 60) return t('social.responsiveness.hours', { count: Math.round(minutes / 60) });
  return t('social.responsiveness.days', { count: Math.round(minutes / (24 * 60)) });
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    row: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
    rowText: { gap: 1 },
    good: { backgroundColor: c.successSoft },
    slow: { backgroundColor: c.warningSoft },
    poor: { backgroundColor: c.dangerSoft },
    label: { ...typography.microStrong },
    detail: { ...typography.micro, color: c.textMuted },
  });
