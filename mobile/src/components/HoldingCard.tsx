import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Holding } from '../types';
import { getLocalizedText } from '../utils/localized';
import { formatDate } from '../utils/date';
import { colors, spacing } from '../theme';
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
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const heldDays = Math.max(0, Math.floor((Date.now() - new Date(holding.purchaseDate).getTime()) / MS_PER_DAY));
  const unitPrice = holding.quantity > 0 ? holding.purchasePrice / holding.quantity : 0;

  const body = (
    <>
      <Text style={styles.title}>{getLocalizedText(holding.projectTitle, i18n.language)}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>x{holding.quantity}</Text>
        <Text style={styles.meta}>
          {holding.currentValue.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={{ color: holding.returnAmount >= 0 ? colors.success : colors.danger, fontWeight: '600' }}>
          {holding.returnAmount >= 0 ? '+' : ''}
          {holding.returnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {t('portfolio.totalInvested')}: {holding.purchasePrice.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={styles.meta}>
          {unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')}/
          {t('project.perUnit')}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.metaSecondary}>
          {t('portfolio.purchaseDate')}: {formatDate(holding.purchaseDate, i18n.language)}
        </Text>
        <Text style={styles.metaSecondary}>{t('portfolio.heldForDays', { days: heldDays })}</Text>
      </View>
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
          <Text style={styles.listedText}>
            {t('portfolio.listedForSale', {
              price: (holding.askingPrice ?? 0).toLocaleString(),
              currency: t('common.currency'),
            })}
          </Text>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: colors.textMuted,
  },
  metaSecondary: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  expandRow: {
    marginTop: spacing.xs,
  },
  expandText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  lotsList: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  lotMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sellRow: {
    marginTop: spacing.sm,
  },
  actionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  listedText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
