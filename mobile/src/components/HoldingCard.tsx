import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Holding } from '../types';
import { getLocalizedText } from '../utils/localized';
import { formatDate } from '../utils/date';
import { radius, spacing, tabularNums, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { ActionSheet, ActionSheetItem, DisclosureRow, Icon, Pill, StatStrip } from './ui';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface Props {
  holding: Holding;
  onPressTitle?: () => void;
  onSellPress: (holding: Holding) => void;
  onCancelListing: (ticketId: string) => void;
  cancellingId?: string | null;
}

// The investor's side of a project, built to the same rules as OwnedProjectCard: headline
// number, one stat band, secondary actions behind "…". There is no hero here because a
// holding carries no cover image — and because what matters on this tab is the money.
export function HoldingCard({ holding, onPressTitle, onSellPress, onCancelListing, cancellingId }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [lotsOpen, setLotsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const heldDays = Math.max(0, Math.floor((Date.now() - new Date(holding.purchaseDate).getTime()) / MS_PER_DAY));
  const unitPrice = holding.quantity > 0 ? holding.purchasePrice / holding.quantity : 0;
  const isPositive = holding.returnAmount >= 0;
  const returnColor = isPositive ? colors.success : colors.danger;
  const sign = isPositive ? '+' : '';
  const listed = holding.status === 'listed_for_sale';

  const menuItems: ActionSheetItem[] = [];
  if (onPressTitle) {
    menuItems.push({ key: 'open', label: t('portfolio.openProject'), icon: 'eye', onPress: onPressTitle });
  }
  if (holding.resaleEnabled && holding.status === 'active') {
    menuItems.push({
      key: 'sell',
      label: t('portfolio.sellTicket'),
      icon: 'tag',
      onPress: () => onSellPress(holding),
    });
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={onPressTitle} disabled={!onPressTitle} style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {getLocalizedText(holding.projectTitle, i18n.language)}
        </Text>
        <Pill
          label={`${sign}${holding.returnPercent.toFixed(1)}%`}
          tone={isPositive ? 'success' : 'danger'}
        />
        {menuItems.length > 0 && (
          <Pressable
            hitSlop={10}
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <Icon name="dots" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </Pressable>

      <View style={styles.heroRow}>
        <Text style={styles.heroValue}>
          {holding.currentValue.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={[styles.heroDelta, { color: returnColor }]}>
          {sign}
          {holding.returnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Text>
      </View>

      <StatStrip
        bounded
        stats={[
          { label: t('home.statTickets'), value: `×${holding.quantity}` },
          {
            label: t('portfolio.statEntryPrice'),
            value: unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          },
          { label: t('portfolio.statHeld'), value: t('home.daysShort', { days: heldDays }) },
        ]}
      />

      <View style={styles.footerRow}>
        <Text style={styles.footerText} numberOfLines={1}>
          {t('portfolio.totalInvested')} {holding.purchasePrice.toLocaleString()} ·{' '}
          {formatDate(holding.purchaseDate, i18n.language)}
        </Text>
        {holding.dividendsReceived > 0 && (
          <Text style={styles.dividends} numberOfLines={1}>
            {t('portfolio.dividendsReceived')} +
            {holding.dividendsReceived.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
        )}
      </View>

      {listed && (
        <View style={styles.listedRow}>
          <Icon name="tag" size={14} color={colors.warning} />
          <Text style={styles.listedText} numberOfLines={1}>
            {t('portfolio.listedForSale', {
              price: (holding.askingPrice ?? 0).toLocaleString(),
              currency: t('common.currency'),
            })}
          </Text>
          <Pressable
            onPress={() => onCancelListing(holding.ticketId)}
            disabled={cancellingId === holding.ticketId}
            style={({ pressed }) => [styles.listedButton, pressed && styles.pressed]}
          >
            <Text style={styles.listedButtonLabel}>{t('portfolio.cancelListingShort')}</Text>
          </Pressable>
        </View>
      )}

      {holding.lotsCount > 1 && (
        <DisclosureRow
          icon="layers"
          label={t('portfolio.mergedLots', { count: holding.lotsCount })}
          expanded={lotsOpen}
          onToggle={() => setLotsOpen((v) => !v)}
        >
          {[...holding.lots]
            .sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1))
            .map((lot) => (
              <View key={lot.ticketId} style={styles.lotRow}>
                <Text style={styles.lotMeta}>
                  {formatDate(lot.purchaseDate, i18n.language)} · ×{lot.quantity}
                </Text>
                <Text
                  style={[styles.lotValue, { color: lot.returnAmount >= 0 ? colors.success : colors.danger }]}
                >
                  {lot.returnAmount >= 0 ? '+' : ''}
                  {lot.returnAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              </View>
            ))}
        </DisclosureRow>
      )}

      <ActionSheet
        visible={menuOpen}
        title={getLocalizedText(holding.projectTitle, i18n.language)}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
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
    pressed: {
      opacity: 0.7,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.subheading,
      flex: 1,
      color: c.text,
    },
    menuButton: {
      paddingLeft: spacing.xs,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      marginBottom: spacing.md - 4,
    },
    heroValue: {
      ...typography.title,
      ...tabularNums,
      color: c.text,
    },
    heroDelta: {
      ...typography.captionStrong,
      ...tabularNums,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.sm + 2,
    },
    footerText: {
      ...typography.micro,
      color: c.textMuted,
      flexShrink: 1,
    },
    dividends: {
      ...typography.micro,
      color: c.success,
    },
    listedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      marginTop: spacing.sm + 2,
    },
    listedText: {
      ...typography.micro,
      color: c.warning,
      flex: 1,
    },
    listedButton: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    listedButtonLabel: {
      ...typography.captionStrong,
      color: c.text,
    },
    lotRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    lotMeta: {
      ...typography.micro,
      color: c.textMuted,
    },
    lotValue: {
      ...typography.micro,
      ...tabularNums,
    },
  });
