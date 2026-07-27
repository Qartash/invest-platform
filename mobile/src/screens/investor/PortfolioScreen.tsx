import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchPortfolio } from '../../api/portfolio';
import { invalidateQuery, useCachedQuery } from '../../api/useCachedQuery';
import { listTicketForSale, cancelTicketListing } from '../../api/tickets';
import { Holding, Portfolio } from '../../types';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useTheme, useThemeStyles } from '../../theme';
import { HoldingCard } from '../../components/HoldingCard';
import { SellTicketModal } from '../../components/SellTicketModal';

function ReturnText({ value }: { value: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const color = value >= 0 ? colors.success : colors.danger;
  const sign = value >= 0 ? '+' : '';
  return (
    <Text style={{ color, fontWeight: '600' }}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')}
    </Text>
  );
}

export function PortfolioScreen() {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [listingHolding, setListingHolding] = useState<Holding | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const {
    data: portfolio,
    loading,
    refreshing,
    refresh,
  } = useCachedQuery<Portfolio>('portfolio', fetchPortfolio);

  const handleConfirmListing = async (quantity: number, askingPrice: number) => {
    if (!listingHolding) return;
    setSubmitting(true);
    try {
      await listTicketForSale(listingHolding.ticketIds, quantity, askingPrice);
      // The ticket now appears on the project's resale shelf, which the feed shows.
      invalidateQuery('projects');
      showAlert(t('portfolio.listingSuccess'));
      setListingHolding(null);
      await refresh();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelListing = async (ticketId: string) => {
    setCancellingId(ticketId);
    try {
      await cancelTicketListing(ticketId);
      invalidateQuery('projects');
      await refresh();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setCancellingId(null);
    }
  };

  const summary = portfolio?.summary;

  return (
    <View style={styles.container}>
      <FlatList
        data={portfolio?.holdings ?? []}
        keyExtractor={(item) => item.ticketId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
        ListHeaderComponent={
          summary ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('portfolio.totalInvested')}</Text>
                <Text style={styles.summaryValue}>
                  {summary.totalInvested.toLocaleString()} {t('common.currency')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('portfolio.currentValue')}</Text>
                <Text style={styles.summaryValue}>
                  {summary.totalCurrentValue.toLocaleString()} {t('common.currency')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('portfolio.todayReturn')}</Text>
                <ReturnText value={summary.todayReturn} />
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('portfolio.monthReturn')}</Text>
                <ReturnText value={summary.monthReturn} />
              </View>
              {summary.totalDividends > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{t('portfolio.dividendsReceived')}</Text>
                  <ReturnText value={summary.totalDividends} />
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('portfolio.totalReturn')}</Text>
                <ReturnText value={summary.totalReturnAmount} />
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <HoldingCard
            holding={item}
            onSellPress={setListingHolding}
            onCancelListing={handleCancelListing}
            cancellingId={cancellingId}
          />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('portfolio.noHoldings')}</Text> : null}
      />

      <SellTicketModal
        holding={listingHolding}
        submitting={submitting}
        onClose={() => setListingHolding(null)}
        onConfirm={handleConfirmListing}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    // Kept to one column rather than gridded: every row here is a label on the left and a
    // figure on the right, and that pairing is what breaks first when the row gets wide.
    listWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },
    summaryCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    summaryLabel: {
      color: c.textMuted,
    },
    summaryValue: {
      fontWeight: '600',
      color: c.text,
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      marginTop: spacing.xl,
    },
  });
