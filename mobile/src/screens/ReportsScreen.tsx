import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  fetchMoneyStats,
  fetchUsersStats,
  MoneyHistoryEntry,
  MoneyStats,
  PeriodBreakdown,
  UserMoneyTotal,
  UsersStats,
} from '../api/stats';
import { Avatar } from '../components/Avatar';
import { InvestorProfileModal } from '../components/InvestorProfileModal';
import { formatDate, formatDateTime } from '../utils/date';
import { colors, spacing } from '../theme';

type Tab = 'users' | 'money';

const PERIOD_KEYS: Array<keyof PeriodBreakdown> = ['total', 'day', 'week', 'month', 'year'];

function PeriodCard({ title, data, suffix }: { title: string; data: PeriodBreakdown; suffix?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {PERIOD_KEYS.map((key) => (
        <View key={key} style={[styles.periodRow, key === 'total' && styles.periodRowTotal]}>
          <Text style={[styles.periodLabel, key === 'total' && styles.periodLabelTotal]}>
            {t(`reports.periods.${key}`)}
          </Text>
          <Text style={[styles.periodValue, key === 'total' && styles.periodValueTotal]}>
            {data[key].toLocaleString()}
            {suffix ? ` ${suffix}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MoneyUserRow({
  entry,
  currency,
  onPress,
}: {
  entry: UserMoneyTotal;
  currency: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable style={styles.userRow} onPress={onPress}>
      <Avatar avatarUrl={entry.avatarUrl} avatarEmoji={entry.avatarEmoji} size={40} />
      <View style={styles.userText}>
        <Text style={styles.userName}>{entry.fullName || entry.username || '—'}</Text>
        <Text style={styles.userMeta}>
          {entry.username ? `@${entry.username} · ` : ''}
          {t('reports.operations', { count: entry.count })}
        </Text>
      </View>
      <Text style={styles.userAmount}>
        {entry.amount.toLocaleString()} {currency}
      </Text>
    </Pressable>
  );
}

function HistoryRow({
  entry,
  currency,
  onPress,
}: {
  entry: MoneyHistoryEntry;
  currency: string;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isDeposit = entry.type === 'deposit';
  return (
    <Pressable style={styles.userRow} onPress={onPress}>
      <Avatar avatarUrl={entry.avatarUrl} avatarEmoji={entry.avatarEmoji} size={40} />
      <View style={styles.userText}>
        <Text style={styles.userName}>{entry.fullName || entry.username || '—'}</Text>
        <Text style={styles.userMeta}>
          {t(`wallet.txType.${entry.type}`)} · {formatDateTime(entry.createdAt, i18n.language)}
        </Text>
      </View>
      <Text style={[styles.userAmount, isDeposit ? styles.amountIn : styles.amountOut]}>
        {isDeposit ? '+' : '−'}
        {entry.amount.toLocaleString()} {currency}
      </Text>
    </Pressable>
  );
}

export function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UsersStats | null>(null);
  const [money, setMoney] = useState<MoneyStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    Promise.all([fetchUsersStats(), fetchMoneyStats()])
      .then(([usersStats, moneyStats]) => {
        setUsers(usersStats);
        setMoney(moneyStats);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useFocusEffect(load);

  const currency = t('common.currency');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tabRow}>
        {(['users', 'money'] as Tab[]).map((key) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {t(key === 'users' ? 'reports.tabUsers' : 'reports.tabMoney')}
            </Text>
          </Pressable>
        ))}
      </View>

      {loadFailed && <Text style={styles.error}>{t('common.error')}</Text>}

      {tab === 'users' && users && (
        <>
          <PeriodCard title={t('reports.registrations')} data={users.registered} />

          <Text style={styles.sectionLabel}>{t('reports.latestUsers')}</Text>
          {users.latest.map((user) => (
            <Pressable key={user.id} style={styles.userRow} onPress={() => setProfileUserId(user.id)}>
              <Avatar avatarUrl={user.avatarUrl} avatarEmoji={user.avatarEmoji} size={40} />
              <View style={styles.userText}>
                <Text style={styles.userName}>{user.fullName || user.username || '—'}</Text>
                <Text style={styles.userMeta}>
                  {user.username ? `@${user.username} · ` : ''}
                  {formatDate(user.createdAt, i18n.language)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </>
      )}

      {tab === 'money' && money && (
        <>
          <PeriodCard title={t('reports.turnover')} data={money.turnover} suffix={currency} />
          <PeriodCard title={t('reports.deposits')} data={money.deposits} suffix={currency} />
          <PeriodCard title={t('reports.withdrawals')} data={money.withdrawals} suffix={currency} />

          <Text style={styles.sectionLabel}>{t('reports.depositors')}</Text>
          {money.depositors.length === 0 && <Text style={styles.emptyText}>{t('reports.noData')}</Text>}
          {money.depositors.map((entry) => (
            <MoneyUserRow key={entry.id} entry={entry} currency={currency} onPress={() => setProfileUserId(entry.id)} />
          ))}

          <Text style={styles.sectionLabel}>{t('reports.withdrawers')}</Text>
          {money.withdrawers.length === 0 && <Text style={styles.emptyText}>{t('reports.noData')}</Text>}
          {money.withdrawers.map((entry) => (
            <MoneyUserRow key={entry.id} entry={entry} currency={currency} onPress={() => setProfileUserId(entry.id)} />
          ))}

          <Text style={styles.sectionLabel}>{t('reports.history')}</Text>
          {money.history.length === 0 && <Text style={styles.emptyText}>{t('reports.noData')}</Text>}
          {money.history.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} currency={currency} onPress={() => setProfileUserId(entry.userId)} />
          ))}
        </>
      )}

      <InvestorProfileModal
        visible={!!profileUserId}
        investorId={profileUserId}
        onClose={() => setProfileUserId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  periodRowTotal: {
    borderTopWidth: 0,
  },
  periodLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  periodLabelTotal: {
    fontWeight: '700',
    color: colors.text,
  },
  periodValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  periodValueTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  userText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  userMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  userAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  amountIn: {
    color: colors.success,
  },
  amountOut: {
    color: colors.danger,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
});
