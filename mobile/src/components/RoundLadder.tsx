import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TicketPriceTier } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  tiers: TicketPriceTier[];
  currentTier: number;
}

// The one thing that only exists on this product: tickets sold in escalating price
// rounds. Rendered as a strip of ticket stubs — punched-notch edges, a torn perforation
// between the round label and the price — instead of a plain list of "Round N: price".
export function RoundLadder({ tiers, currentTier }: Props) {
  const { t } = useTranslation();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tiers.map((tier) => {
        const isPast = tier.tier < currentTier;
        const isCurrent = tier.tier === currentTier;

        return (
          <View
            key={tier.tier}
            style={[styles.stub, isPast && styles.stubPast, isCurrent && styles.stubCurrent]}
          >
            {isCurrent && (
              <View style={styles.nowTag}>
                <Text style={styles.nowTagText}>{t('project.roundNow')}</Text>
              </View>
            )}
            <Text
              style={[styles.roundLabel, isPast && styles.roundLabelPast, isCurrent && styles.roundLabelCurrent]}
              numberOfLines={1}
            >
              {isPast ? '✓ ' : ''}
              {t('project.roundLabel', { round: tier.tier + 1 })}
            </Text>
            <Text style={styles.range}>
              {tier.ticketsFrom}–{tier.ticketsTo}
            </Text>

            <View style={styles.perforationRow}>
              <View style={[styles.notch, styles.notchLeft]} />
              <View style={styles.dashedLine} />
              <View style={[styles.notch, styles.notchRight]} />
            </View>

            <Text style={[styles.price, isPast && styles.pricePast, isCurrent && styles.priceCurrent]}>
              {tier.price.toLocaleString()}
            </Text>
            <Text style={[styles.currency, isCurrent && styles.currencyCurrent]}>{t('common.currency')}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const NOTCH_SIZE = 10;

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  stub: {
    width: 116,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  stubPast: {
    backgroundColor: 'rgba(34, 165, 89, 0.06)',
    borderColor: 'rgba(34, 165, 89, 0.25)',
  },
  stubCurrent: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  nowTag: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 10,
    borderTopRightRadius: 11,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  nowTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  roundLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  roundLabelPast: {
    color: colors.success,
  },
  roundLabelCurrent: {
    color: colors.primary,
  },
  range: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -spacing.sm,
    marginVertical: spacing.xs,
  },
  dashedLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  notch: {
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    borderRadius: NOTCH_SIZE / 2,
    backgroundColor: colors.background,
  },
  notchLeft: {
    marginLeft: -NOTCH_SIZE / 2,
  },
  notchRight: {
    marginRight: -NOTCH_SIZE / 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  pricePast: {
    color: colors.textMuted,
  },
  priceCurrent: {
    color: colors.primary,
  },
  currency: {
    fontSize: 10,
    color: colors.textMuted,
  },
  currencyCurrent: {
    color: colors.primary,
  },
});
