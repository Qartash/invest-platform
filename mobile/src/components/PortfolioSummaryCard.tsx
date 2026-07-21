import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PortfolioSummary } from '../types';
import { radius, spacing, tabularNums, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { StatStrip } from './ui';

interface Props {
  summary: PortfolioSummary;
}

// Sits above the holdings list. The full breakdown lives on the portfolio screen under the
// profile; this is the one line an investor opens the tab to read — what it's worth now, and
// whether that's up or down.
export function PortfolioSummaryCard({ summary }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isPositive = summary.totalReturnAmount >= 0;
  const tone = isPositive ? colors.success : colors.danger;
  const sign = isPositive ? '+' : '';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('portfolio.currentValue')}</Text>
      <View style={styles.heroRow}>
        <Text style={styles.heroValue}>
          {summary.totalCurrentValue.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={[styles.heroDelta, { color: tone }]}>
          {sign}
          {summary.totalReturnPercent.toFixed(1)}%
        </Text>
      </View>

      <StatStrip
        stats={[
          { label: t('portfolio.totalInvested'), value: summary.totalInvested.toLocaleString() },
          {
            label: t('portfolio.totalReturn'),
            value: `${sign}${summary.totalReturnAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            tone,
          },
          {
            label: t('portfolio.dividendsReceived'),
            value: summary.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          },
        ]}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md - 4,
      marginBottom: spacing.md,
    },
    label: {
      ...typography.eyebrow,
      color: c.textMuted,
      marginBottom: 3,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      marginBottom: spacing.md - 4,
    },
    heroValue: {
      ...typography.display,
      ...tabularNums,
      color: c.text,
    },
    heroDelta: {
      ...typography.captionStrong,
      ...tabularNums,
    },
  });
