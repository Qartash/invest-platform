import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { deposit, fetchTransactions, fetchWallet, Transaction, withdraw } from '../../api/wallet';
import { Wallet } from '../../types';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useTheme, useThemeStyles } from '../../theme';
import { formatDateTime } from '../../utils/date';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';

const TX_ICON: Record<string, string> = {
  deposit: '⬇️',
  withdraw: '⬆️',
  buy: '🎟️',
  sell: '💱',
  dividend: '💰',
};

const TX_IS_CREDIT: Record<string, boolean> = {
  deposit: true,
  withdraw: false,
  buy: false,
  sell: true,
  dividend: true,
};

// An account that has been trading for a while has hundreds of rows, and the whole
// ledger dumped into one scroll buries the balance and the deposit field above it.
const PAGE_SIZE = 10;

export function WalletScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Tapping through pages faster than the server answers would otherwise let an
  // earlier page land last and contradict the number under the arrows.
  const requestIdRef = useRef(0);

  const load = useCallback(async (targetPage: number) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const [walletData, txPage] = await Promise.all([fetchWallet(), fetchTransactions(targetPage, PAGE_SIZE)]);
      if (requestId !== requestIdRef.current) return;
      setWallet(walletData);
      setTransactions(txPage.items);
      setTotal(txPage.total);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Coming back to the screen starts at the newest page rather than wherever
      // the last visit left off — the recent rows are what the balance refers to.
      setPage(1);
      load(1);
    }, [load]),
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (target: number) => {
    if (target < 1 || target > pageCount || target === page) return;
    setPage(target);
    load(target);
  };

  const parsedAmount = parseFloat(amount) || 0;

  const handleDeposit = async () => {
    setSubmitting(true);
    try {
      await deposit(parsedAmount);
      setAmount('');
      // The row just created is the newest one, so this jumps to where it is
      // instead of reloading a page it isn't on.
      setPage(1);
      await load(1);
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    try {
      await withdraw(parsedAmount);
      setAmount('');
      setPage(1);
      await load(1);
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(page)} />}
        contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
        ListHeaderComponent={
          <View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>{t('wallet.balance')}</Text>
              <Text style={styles.balanceValue}>
                {wallet ? parseFloat(wallet.balance).toLocaleString() : '—'} {t('common.currency')}
              </Text>
              {wallet && parseFloat(wallet.investCredit ?? '0') > 0 && (
                <Text style={styles.investCredit}>
                  {t('wallet.investCredit')}: {parseFloat(wallet.investCredit ?? '0').toLocaleString()}{' '}
                  {t('common.currency')}
                </Text>
              )}
            </View>
            <TextField
              label={t('wallet.amount')}
              keyboardType="decimal-pad"
              format="decimal"
              placeholder="0"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <PrimaryButton title={t('wallet.deposit')} onPress={handleDeposit} loading={submitting} disabled={parsedAmount <= 0} />
              </View>
              <View style={{ width: spacing.sm }} />
              <View style={styles.actionButton}>
                <PrimaryButton
                  title={t('wallet.withdraw')}
                  variant="outline"
                  onPress={handleWithdraw}
                  loading={submitting}
                  disabled={parsedAmount <= 0}
                />
              </View>
            </View>
            <View style={styles.historyHeaderRow}>
              <Text style={styles.historyHeader}>{t('wallet.history')}</Text>
              {total > 0 && <Text style={styles.historyCount}>{t('wallet.txCount', { count: total })}</Text>}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isCredit = TX_IS_CREDIT[item.type] ?? true;
          return (
            <View style={styles.txRow}>
              <Text style={styles.txIcon}>{TX_ICON[item.type] ?? '•'}</Text>
              <View style={styles.txInfo}>
                <Text style={styles.txType}>{t(`wallet.txType.${item.type}`, { defaultValue: item.type })}</Text>
                {!!item.description && <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>}
                <Text style={styles.txDate}>{formatDateTime(item.createdAt, i18n.language)}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: isCredit ? colors.success : colors.text }]}>
                  {isCredit ? '+' : '−'}
                  {parseFloat(item.amount).toLocaleString()} {t('common.currency')}
                </Text>
                {!!item.account && <Text style={styles.txAccount}>{t(`wallet.account.${item.account}`)}</Text>}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('wallet.noTransactions')}</Text> : null}
        // Only worth drawing once there is a second page to reach. A single page of
        // history with dead arrows under it reads as something being broken.
        ListFooterComponent={
          pageCount > 1 ? (
            <View style={styles.pager}>
              <Pressable
                style={[styles.pagerButton, page <= 1 && styles.pagerButtonDisabled]}
                disabled={page <= 1 || loading}
                onPress={() => goToPage(page - 1)}
                accessibilityRole="button"
                accessibilityLabel={t('wallet.prevPage')}
              >
                <Text style={[styles.pagerArrow, page <= 1 && styles.pagerArrowDisabled]}>‹</Text>
              </Pressable>
              <Text style={styles.pagerLabel}>{t('wallet.pageOf', { page, pageCount })}</Text>
              <Pressable
                style={[styles.pagerButton, page >= pageCount && styles.pagerButtonDisabled]}
                disabled={page >= pageCount || loading}
                onPress={() => goToPage(page + 1)}
                accessibilityRole="button"
                accessibilityLabel={t('wallet.nextPage')}
              >
                <Text style={[styles.pagerArrow, page >= pageCount && styles.pagerArrowDisabled]}>›</Text>
              </Pressable>
            </View>
          ) : null
        }
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
    listWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },
    balanceCard: {
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    balanceLabel: {
      color: c.textOnAccentMuted,
      fontSize: 13,
      marginBottom: spacing.xs,
    },
    investCredit: {
      color: c.textOnAccentMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
    balanceValue: {
      color: c.textOnAccent,
      fontSize: 32,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    actionsRow: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
    },
    actionButton: {
      flex: 1,
    },
    historyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    historyHeader: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textMuted,
    },
    historyCount: {
      fontSize: 12,
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    pagerButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pagerButtonDisabled: {
      opacity: 0.4,
    },
    pagerArrow: {
      fontSize: 22,
      lineHeight: 24,
      fontWeight: '600',
      color: c.text,
    },
    pagerArrowDisabled: {
      color: c.textMuted,
    },
    pagerLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
      fontVariant: ['tabular-nums'],
      marginHorizontal: spacing.md,
      minWidth: 64,
      textAlign: 'center',
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    txIcon: {
      fontSize: 18,
      marginRight: spacing.sm,
    },
    txInfo: {
      flex: 1,
    },
    txType: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },
    txDesc: {
      fontSize: 12,
      color: c.text,
      marginTop: 1,
    },
    txDate: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 1,
    },
    txRight: {
      alignItems: 'flex-end',
      marginLeft: spacing.sm,
    },
    txAmount: {
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    txAccount: {
      fontSize: 10,
      fontWeight: '600',
      color: c.textMuted,
      marginTop: 2,
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      marginTop: spacing.xl,
    },
  });
