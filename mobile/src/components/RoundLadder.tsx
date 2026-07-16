import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TicketPriceTier } from '../types';
import { radius, spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../theme';

interface Props {
  tiers: TicketPriceTier[];
  currentTier: number;
}

// The one thing that only exists on this product: tickets sold in escalating price
// rounds. Rendered as a strip of ticket stubs — punched-notch edges, a torn perforation
// between the round label and the price — instead of a plain list of "Round N: price".
//
// The notches fake punched holes by painting circles in the *page* colour, so this must sit
// directly on `colors.background` — dropping it inside a Card turns them into visible dots.
export function RoundLadder({ tiers, currentTier }: Props) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tiers.map((tier) => {
        const isPast = tier.tier < currentTier;
        const isCurrent = tier.tier === currentTier;

        return (
          <View key={tier.tier} style={[styles.stub, isPast && styles.stubPast, isCurrent && styles.stubCurrent]}>
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      paddingVertical: spacing.xs,
      paddingRight: spacing.sm,
    },
    stub: {
      width: 116,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginRight: spacing.sm,
      overflow: 'hidden',
    },
    stubPast: {
      backgroundColor: c.successSoft,
      borderColor: c.successSoft,
    },
    stubCurrent: {
      backgroundColor: c.surface,
      borderColor: c.primary,
      borderWidth: 2,
    },
    nowTag: {
      position: 'absolute',
      top: -1,
      right: -1,
      backgroundColor: c.primary,
      borderBottomLeftRadius: radius.md,
      borderTopRightRadius: radius.md + 1,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    nowTagText: {
      fontSize: 9,
      fontWeight: '700',
      color: c.textOnAccent,
      letterSpacing: 0.3,
    },
    roundLabel: {
      ...typography.microStrong,
      color: c.textMuted,
    },
    roundLabelPast: {
      color: c.success,
    },
    roundLabelCurrent: {
      color: c.primary,
    },
    range: {
      fontSize: 10,
      color: c.textMuted,
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
      borderColor: c.border,
    },
    notch: {
      width: NOTCH_SIZE,
      height: NOTCH_SIZE,
      borderRadius: NOTCH_SIZE / 2,
      backgroundColor: c.background,
    },
    notchLeft: {
      marginLeft: -NOTCH_SIZE / 2,
    },
    notchRight: {
      marginRight: -NOTCH_SIZE / 2,
    },
    price: {
      ...typography.subheading,
      ...tabularNums,
      fontWeight: '700',
      color: c.text,
    },
    pricePast: {
      color: c.textMuted,
    },
    priceCurrent: {
      color: c.primary,
    },
    currency: {
      fontSize: 10,
      color: c.textMuted,
    },
    currencyCurrent: {
      color: c.primary,
    },
  });
