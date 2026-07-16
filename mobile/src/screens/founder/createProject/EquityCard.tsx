import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../../../theme';
import { equityPerTicket, impliedValuation } from '../../../utils/pricing';

// Below this the founder no longer holds a controlling stake; at exactly 50/50 neither
// side can decide anything, so an even split is worth the same warning as losing it.
const CONTROL_THRESHOLD = 50;

interface Props {
  equityOfferedPercent: number;
  targetAmount: number;
  totalTickets: number;
  onHintPress: () => void;
}

/**
 * The consequences of the equity field, shown right under it. Founders tend to pick the
 * percentage first and think about what it means afterwards — so the valuation it implies
 * is the headline here, not a detail: "10M for 49%" only reads as expensive or cheap once
 * you see it means the company is being priced at ~20.4M.
 */
export function EquityCard({ equityOfferedPercent, targetAmount, totalTickets, onHintPress }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const currency = t('common.currency');

  const retained = Math.max(0, 100 - equityOfferedPercent);
  const valuation = impliedValuation(targetAmount, equityOfferedPercent);
  const perTicket = equityPerTicket(equityOfferedPercent, totalTickets);
  const losesControl = equityOfferedPercent >= CONTROL_THRESHOLD;

  const percent = (value: number, digits = 2) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}%`;

  return (
    <View style={styles.card}>
      <Pressable style={styles.labelRow} hitSlop={8} onPress={onHintPress}>
        <Text style={styles.label}>{t('founder.wizard.impliedValuation')}</Text>
        <Text style={styles.hintIcon}>ⓘ</Text>
      </Pressable>
      {valuation > 0 ? (
        <Text style={styles.valuation}>
          {valuation.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currency}
        </Text>
      ) : (
        <Text style={styles.valuationEmpty}>{t('founder.wizard.valuationNotAvailable')}</Text>
      )}

      {equityOfferedPercent > 0 && (
        <>
          <View style={styles.splitBar}>
            <View style={[styles.splitInvestors, { flex: Math.max(equityOfferedPercent, 0.01) }]} />
            <View style={[styles.splitFounder, { flex: Math.max(retained, 0.01) }]} />
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotInvestors]} />
              <Text style={styles.legendText}>
                {t('founder.wizard.equityInvestors')} {percent(equityOfferedPercent)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotFounder]} />
              <Text style={styles.legendText}>
                {t('founder.wizard.equityRetained')} {percent(retained)}
              </Text>
            </View>
          </View>
        </>
      )}

      {perTicket > 0 && (
        <Text style={styles.perTicket}>{t('founder.wizard.equityPerTicket', { percent: percent(perTicket, 4) })}</Text>
      )}

      {losesControl && <Text style={styles.warning}>{t('founder.wizard.equityControlWarning')}</Text>}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // Accent border to match EconomicsCard: like the ticket price, everything here is
    // derived from the fields above rather than typed in.
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    label: {
      ...typography.eyebrow,
      color: c.textMuted,
    },
    hintIcon: {
      ...typography.micro,
      fontWeight: '700',
      color: c.textMuted,
    },
    valuation: {
      ...typography.display,
      ...tabularNums,
      color: c.primary,
    },
    valuationEmpty: {
      ...typography.bodyStrong,
      color: c.textMuted,
    },
    splitBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: radius.sm,
      overflow: 'hidden',
      marginTop: spacing.md,
    },
    splitInvestors: {
      backgroundColor: c.primary,
    },
    splitFounder: {
      backgroundColor: c.border,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotInvestors: {
      backgroundColor: c.primary,
    },
    dotFounder: {
      backgroundColor: c.border,
    },
    legendText: {
      ...typography.caption,
      ...tabularNums,
      color: c.textMuted,
    },
    perTicket: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
      marginTop: spacing.sm,
    },
    warning: {
      ...typography.caption,
      color: c.warning,
      backgroundColor: c.warningSoft,
      borderRadius: radius.sm,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm,
      marginTop: spacing.sm,
    },
  });
