import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  fetchLatestUsers,
  fetchMoneyHistory,
  fetchMoneyStats,
  fetchStatsSeries,
  fetchUsersStats,
  LatestUser,
  MoneyHistoryEntry,
  MoneyStats,
  PeriodBreakdown,
  SeriesPoint,
  SeriesRange,
  STATS_PAGE_SIZE,
  StatsSeries,
  UserMoneyTotal,
  UsersStats,
} from '../api/stats';
import { Avatar } from '../components/Avatar';
import { InvestorProfileModal } from '../components/InvestorProfileModal';
import { TrendChart } from '../components/TrendChart';
import { formatDate, formatDateTime } from '../utils/date';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useTheme, useThemeStyles } from '../theme';

type Tab = 'users' | 'money';

const PERIOD_KEYS: Array<keyof PeriodBreakdown> = ['total', 'day', 'week', 'month', 'year'];
const RANGES: SeriesRange[] = ['day', '5day', 'month', 'year', '5year', 'max'];

function RangeSelector({ value, onChange }: { value: SeriesRange; onChange: (r: SeriesRange) => void }) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.rangeRow}>
      {RANGES.map((r) => (
        <Pressable key={r} style={[styles.rangeChip, value === r && styles.rangeChipActive]} onPress={() => onChange(r)}>
          <Text style={[styles.rangeChipText, value === r && styles.rangeChipTextActive]}>
            {t(`reports.range.${r}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

interface CardChart {
  points: SeriesPoint[];
  width: number;
  color?: string;
  range: SeriesRange;
  onRangeChange: (r: SeriesRange) => void;
}

function PeriodCard({
  title,
  data,
  suffix,
  chart,
}: {
  title: string;
  data: PeriodBreakdown;
  suffix?: string;
  chart?: CardChart;
}) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [chartOpen, setChartOpen] = useState(false);
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

      {chart && (
        <>
          <Pressable style={styles.chartToggle} onPress={() => setChartOpen((v) => !v)}>
            <Text style={styles.chartToggleText}>
              📈 {chartOpen ? t('reports.hideChart') : t('reports.showChart')}
            </Text>
            <Text style={styles.chartToggleIcon}>{chartOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {chartOpen && (
            <>
              <RangeSelector value={chart.range} onChange={chart.onRangeChange} />
              <TrendChart points={chart.points} width={chart.width} color={chart.color} />
            </>
          )}
        </>
      )}
    </View>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / STATS_PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <View style={styles.pagination}>
      <Pressable
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
        style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
      >
        <Text style={styles.pageButtonText}>‹</Text>
      </Pressable>
      <Text style={styles.pageInfo}>{t('reports.pageOf', { page, pages: pageCount })}</Text>
      <Pressable
        disabled={page >= pageCount}
        onPress={() => onChange(page + 1)}
        style={[styles.pageButton, page >= pageCount && styles.pageButtonDisabled]}
      >
        <Text style={styles.pageButtonText}>›</Text>
      </Pressable>
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
  const styles = useThemeStyles(createStyles);
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
  const styles = useThemeStyles(createStyles);
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
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UsersStats | null>(null);
  const [money, setMoney] = useState<MoneyStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [latestUsers, setLatestUsers] = useState<LatestUser[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItems, setHistoryItems] = useState<MoneyHistoryEntry[]>([]);
  const [range, setRange] = useState<SeriesRange>('month');
  const [series, setSeries] = useState<StatsSeries | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  const { isCompact } = useBreakpoint();
  // The charts are drawn at an explicit pixel width, so the number has to match the column
  // they sit in. Deriving it from the window is wrong on a wide screen — the side rail eats
  // a slice the window doesn't know about — so the real content width is measured once it
  // has laid out, and the window is only the first-frame guess before that lands.
  // `chartArea` is the width of the content minus its outer gutters — measured, not derived,
  // because the side rail on a wide window takes a slice the window dimensions don't reflect.
  const [chartArea, setChartArea] = useState(Math.min(screenWidth, maxWidth.page) - spacing.lg * 2);
  // The charts sit one card-padding in from that on each side.
  const chartWidth = chartArea - spacing.md * 2;

  const load = useCallback(() => {
    setLoadFailed(false);
    Promise.all([fetchUsersStats(), fetchMoneyStats(), fetchStatsSeries(range)])
      .then(([usersStats, moneyStats, seriesData]) => {
        setUsers(usersStats);
        setMoney(moneyStats);
        setUsersPage(1);
        setLatestUsers(usersStats.latest);
        setHistoryPage(1);
        setHistoryItems(moneyStats.history);
        setSeries(seriesData);
      })
      .catch(() => setLoadFailed(true));
  }, [range]);

  useFocusEffect(load);

  const changeRange = (next: SeriesRange) => {
    setRange(next);
    fetchStatsSeries(next)
      .then(setSeries)
      .catch(() => setLoadFailed(true));
  };

  const changeUsersPage = (page: number) => {
    setUsersPage(page);
    fetchLatestUsers(page)
      .then((res) => setLatestUsers(res.items))
      .catch(() => setLoadFailed(true));
  };

  const changeHistoryPage = (page: number) => {
    setHistoryPage(page);
    fetchMoneyHistory(page)
      .then((res) => setHistoryItems(res.items))
      .catch(() => setLoadFailed(true));
  };

  const currency = t('common.currency');

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}>
      {/* The tab row spans the full inner width of the content, so its measured width is
          exactly the room the cards below it have to work with. */}
      <View
        style={styles.tabRow}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (Math.abs(w - chartArea) > 1) setChartArea(w);
        }}
      >
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
          <PeriodCard
            title={t('reports.registrations')}
            data={users.registered}
            chart={{
              points: series?.registrations ?? [],
              width: chartWidth,
              range,
              onRangeChange: changeRange,
            }}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t('reports.latestUsers')}</Text>
            <Text style={styles.sectionCount}>{t('reports.totalUsers', { count: users.registered.total })}</Text>
          </View>
          {latestUsers.map((user) => (
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
          <Pagination page={usersPage} total={users.registered.total} onChange={changeUsersPage} />
        </>
      )}

      {tab === 'money' && money && (
        <>
          <PeriodCard
            title={t('reports.turnover')}
            data={money.turnover}
            suffix={currency}
            chart={{ points: series?.turnover ?? [], width: chartWidth, range, onRangeChange: changeRange }}
          />
          <PeriodCard
            title={t('reports.deposits')}
            data={money.deposits}
            suffix={currency}
            chart={{
              points: series?.deposits ?? [],
              width: chartWidth,
              color: colors.success,
              range,
              onRangeChange: changeRange,
            }}
          />
          <PeriodCard
            title={t('reports.withdrawals')}
            data={money.withdrawals}
            suffix={currency}
            chart={{
              points: series?.withdrawals ?? [],
              width: chartWidth,
              color: colors.danger,
              range,
              onRangeChange: changeRange,
            }}
          />

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

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{t('reports.history')}</Text>
            <Text style={styles.sectionCount}>{t('reports.totalOperations', { count: money.historyTotal })}</Text>
          </View>
          {historyItems.length === 0 && <Text style={styles.emptyText}>{t('reports.noData')}</Text>}
          {historyItems.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} currency={currency} onPress={() => setProfileUserId(entry.userId)} />
          ))}
          <Pagination page={historyPage} total={money.historyTotal} onChange={changeHistoryPage} />
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      padding: spacing.lg,
    },
    // A single reading column: the charts are sized to `page` above, and the rows below
    // them are label-and-figure pairs that don't want to be any wider.
    contentWide: {
      maxWidth: maxWidth.page,
      width: '100%',
      alignSelf: 'center',
    },
    tabRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderBottomWidth: 2,
      borderBottomColor: c.border,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomColor: c.primary,
    },
    tabText: {
      color: c.textMuted,
      fontWeight: '600',
    },
    tabTextActive: {
      color: c.primary,
    },
    error: {
      color: c.danger,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.sm,
    },
    chartToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    chartToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.primary,
    },
    chartToggleIcon: {
      fontSize: 11,
      color: c.primary,
    },
    rangeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    rangeChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 8,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    rangeChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    rangeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
    },
    rangeChipTextActive: {
      color: c.textOnAccent,
    },
    periodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 5,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    periodRowTotal: {
      borderTopWidth: 0,
    },
    periodLabel: {
      color: c.textMuted,
      fontSize: 13,
    },
    periodLabelTotal: {
      fontWeight: '700',
      color: c.text,
    },
    periodValue: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
    },
    periodValueTotal: {
      fontSize: 15,
      fontWeight: '700',
      color: c.primary,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionCount: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    pagination: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    pageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageButtonDisabled: {
      opacity: 0.35,
    },
    pageButtonText: {
      fontSize: 20,
      color: c.text,
      lineHeight: 22,
    },
    pageInfo: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
      marginHorizontal: spacing.md,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
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
      color: c.text,
    },
    userMeta: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 1,
    },
    chevron: {
      fontSize: 20,
      color: c.textMuted,
      marginRight: spacing.xs,
    },
    userAmount: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginLeft: spacing.sm,
    },
    amountIn: {
      color: c.success,
    },
    amountOut: {
      color: c.danger,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: spacing.md,
    },
  });
