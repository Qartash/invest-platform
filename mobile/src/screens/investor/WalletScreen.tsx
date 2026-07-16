import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { deposit, fetchTransactions, fetchWallet, Transaction, withdraw } from '../../api/wallet';
import { Wallet } from '../../types';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../../theme';
import { formatDateTime } from '../../utils/date';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { showAlert } from '../../utils/alert';

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

export function WalletScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [walletData, txData] = await Promise.all([fetchWallet(), fetchTransactions()]);
      setWallet(walletData);
      setTransactions(txData);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const parsedAmount = parseFloat(amount) || 0;

  const handleDeposit = async () => {
    setSubmitting(true);
    try {
      await deposit(parsedAmount);
      setAmount('');
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setSubmitting(true);
    try {
      await withdraw(parsedAmount);
      setAmount('');
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.list}
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
            <Text style={styles.historyHeader}>{t('wallet.history')}</Text>
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
    historyHeader: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textMuted,
      marginBottom: spacing.sm,
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
