import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Holding } from '../types';
import { getLocalizedText } from '../utils/localized';
import { formatDate } from '../utils/date';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { PrimaryButton } from './PrimaryButton';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface Props {
  holding: Holding;
  onPressTitle?: () => void;
  onSellPress: (holding: Holding) => void;
  onCancelListing: (ticketId: string) => void;
  cancellingId?: string | null;
}

export function HoldingCard({ holding, onPressTitle, onSellPress, onCancelListing, cancellingId }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const heldDays = Math.max(0, Math.floor((Date.now() - new Date(holding.purchaseDate).getTime()) / MS_PER_DAY));
  const unitPrice = holding.quantity > 0 ? holding.purchasePrice / holding.quantity : 0;

  const isPositive = holding.returnAmount >= 0;
  const returnColor = isPositive ? colors.success : colors.danger;
  const returnBg = isPositive ? colors.successSoft : colors.dangerSoft;

  const body = (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {getLocalizedText(holding.projectTitle, i18n.language)}
        </Text>
        <View style={[styles.returnBadge, { backgroundColor: returnBg }]}>
          <Text style={[styles.returnBadgeText, { color: returnColor }]}>
            {isPositive ? '+' : ''}
            {holding.returnPercent.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={styles.heroRow}>
        <Text style={styles.heroValue}>
          {holding.currentValue.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={[styles.heroDelta, { color: returnColor }]}>
          {isPositive ? '+' : ''}
          {holding.returnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')}
        </Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statIcon}>🎟️</Text>
          <Text style={styles.statText}>x{holding.quantity}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statIcon}>🏷️</Text>
          <Text style={styles.statText}>
            {unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{t('project.perUnit')}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statText}>{t('portfolio.heldForDays', { days: heldDays })}</Text>
        </View>
      </View>
      <Text style={styles.investedNote}>
        {t('portfolio.totalInvested')}: {holding.purchasePrice.toLocaleString()} {t('common.currency')} ·{' '}
        {formatDate(holding.purchaseDate, i18n.language)}
      </Text>
      {holding.dividendsReceived > 0 && (
        <Text style={styles.dividendNote}>
          {t('portfolio.dividendsReceived')}: +
          {holding.dividendsReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')}
        </Text>
      )}
    </>
  );

  return (
    <View style={styles.card}>
      {onPressTitle ? <Pressable onPress={onPressTitle}>{body}</Pressable> : body}

      {holding.lotsCount > 1 && (
        <>
          <Pressable style={styles.expandRow} onPress={() => setExpanded((v) => !v)}>
            <Text style={styles.expandText}>
              {t('portfolio.mergedLots', { count: holding.lotsCount })} · {expanded ? t('portfolio.hidePurchases') : t('portfolio.showPurchases')}
            </Text>
          </Pressable>
          {expanded && (
            <View style={styles.lotsList}>
              {[...holding.lots]
                .sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1))
                .map((lot) => (
                  <View key={lot.ticketId} style={styles.lotRow}>
                    <Text style={styles.lotMeta}>
                      {formatDate(lot.purchaseDate, i18n.language)} · x{lot.quantity}
                    </Text>
                    <Text style={{ color: lot.returnAmount >= 0 ? colors.success : colors.danger, fontSize: 12 }}>
                      {lot.returnAmount >= 0 ? '+' : ''}
                      {lot.returnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </>
      )}

      {holding.resaleEnabled && holding.status === 'active' && (
        <View style={styles.actionRow}>
          <PrimaryButton
            title={t('portfolio.sellTicket')}
            variant="outline"
            size="small"
            onPress={() => onSellPress(holding)}
          />
        </View>
      )}
      {holding.status === 'listed_for_sale' && (
        <View style={styles.sellRow}>
          <View style={styles.listedBadge}>
            <Text style={styles.listedBadgeText}>
              {t('portfolio.listedForSale', {
                price: (holding.askingPrice ?? 0).toLocaleString(),
                currency: t('common.currency'),
              })}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <PrimaryButton
              title={t('portfolio.cancelListing')}
              variant="outline"
              size="small"
              onPress={() => onCancelListing(holding.ticketId)}
              loading={cancellingId === holding.ticketId}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
      marginRight: spacing.sm,
    },
    returnBadge: {
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    returnBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    heroValue: {
      fontSize: 20,
      fontWeight: '700',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    heroDelta: {
      fontSize: 13,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    statRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    statIcon: {
      fontSize: 12,
      marginRight: spacing.xs,
    },
    statText: {
      fontSize: 12,
      fontWeight: '500',
      color: c.textMuted,
    },
    investedNote: {
      fontSize: 11,
      color: c.textMuted,
    },
    dividendNote: {
      fontSize: 11,
      fontWeight: '600',
      color: c.success,
      marginTop: 1,
    },
    expandRow: {
      marginTop: spacing.xs,
    },
    expandText: {
      fontSize: 12,
      color: c.primary,
      fontWeight: '600',
    },
    lotsList: {
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    lotRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    lotMeta: {
      fontSize: 12,
      color: c.textMuted,
    },
    sellRow: {
      marginTop: spacing.sm,
    },
    actionRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    listedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.warning,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    listedBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.warning,
    },
  });
