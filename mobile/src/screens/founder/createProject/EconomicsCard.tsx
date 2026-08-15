import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../../../theme';
import { PricingPreviewTier } from '../../../utils/pricing';

interface Props {
  /** Derived from the funding goal, ticket count and rounds — never typed in by hand. */
  ticketPrice: number;
  tiers: PricingPreviewTier[];
  onHintPress: () => void;
}

/**
 * The round-1 ticket price, sitting directly under the four inputs it is computed from.
 * Its whole job is to make "I changed the rounds, so the price moved" visible in one
 * glance — which is why it lives in the flow right below those fields rather than in a
 * summary further down the form.
 */
export function EconomicsCard({ ticketPrice, tiers, onHintPress }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currency = t('common.currency');

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.priceBlock}>
          <Pressable style={styles.labelRow} hitSlop={8} onPress={onHintPress}>
            <Text style={styles.label}>{t('founder.wizard.ticketPriceRound1')}</Text>
            <Text style={styles.hintIcon}>ⓘ</Text>
          </Pressable>
          {ticketPrice > 0 ? (
            <Text style={styles.price}>
              {ticketPrice.toLocaleString()} {currency}
            </Text>
          ) : (
            <Text style={styles.priceEmpty}>{t('founder.ticketPriceNotAvailable')}</Text>
          )}
        </View>
        {tiers.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setOpen((prev) => !prev)}>
            <Text style={styles.toggle}>
              {t('founder.wizard.roundsToggle')} {open ? '⌃' : '⌄'}
            </Text>
          </Pressable>
        )}
      </View>

      {open && tiers.length > 0 && (
        <View style={styles.body}>
          {tiers.map((tier) => (
            <View key={tier.tier} style={styles.tierRow}>
              <Text style={styles.tierName}>{t('project.roundLabel', { round: tier.tier + 1 })}</Text>
              <Text style={styles.tierRange}>
                {tier.ticketsFrom + 1}–{tier.ticketsTo}
              </Text>
              <Text style={styles.tierPrice}>
                {tier.price.toLocaleString()} {currency}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    // Accent border rather than a plain card: this is the one number on the step that
    // is an output, not an input.
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    priceBlock: {
      flexShrink: 1,
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
    price: {
      ...typography.display,
      ...tabularNums,
      color: c.primary,
    },
    priceEmpty: {
      ...typography.bodyStrong,
      color: c.textMuted,
    },
    toggle: {
      ...typography.captionStrong,
      color: c.primary,
    },
    body: {
      marginTop: spacing.sm + 4,
      paddingTop: spacing.sm + 4,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs + 2,
    },
    tierName: {
      ...typography.caption,
      color: c.textMuted,
    },
    tierRange: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
      flex: 1,
      textAlign: 'right',
      marginRight: spacing.sm + 2,
    },
    tierPrice: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.text,
    },
  });
