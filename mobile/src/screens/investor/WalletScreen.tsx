import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { deposit, fetchTransactions, fetchWallet, Transaction, withdraw } from '../../api/wallet';
import { Wallet } from '../../types';
import { colors, spacing } from '../../theme';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { showAlert } from '../../utils/alert';

export function WalletScreen() {
  const { t } = useTranslation();
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
      <Text style={styles.header}>{t('wallet.title')}</Text>
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
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <Text style={styles.txType}>{item.type}</Text>
            <Text style={styles.txAmount}>
              {parseFloat(item.amount).toLocaleString()} {t('common.currency')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceLabel: {
    color: '#DDEBE0',
    marginBottom: spacing.xs,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
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
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  txType: {
    color: colors.text,
    textTransform: 'capitalize',
  },
  txAmount: {
    color: colors.text,
    fontWeight: '600',
  },
});
