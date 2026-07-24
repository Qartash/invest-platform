import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BudgetItemStatus,
  ExpenseCategory,
  ProjectBudgetItem,
  ProjectExpense,
  ProjectFinancialReport,
  ProjectIncome,
} from '../types';
import {
  addProjectExpense,
  addProjectFinancialReport,
  addProjectIncome,
  deleteProjectExpense,
  deleteProjectFinancialReport,
  deleteProjectIncome,
  fetchProjectExpenses,
  fetchProjectFinancialReports,
  fetchProjectIncomes,
  payProjectFinancialReport,
} from '../api/projectFinance';
import { fetchProjectBudgetItems, updateProjectBudgetItemStatus } from '../api/projects';
import { requestRelease } from '../api/projectFunding';
import { fetchWallet } from '../api/wallet';
import { formatDate, formatMonth } from '../utils/date';
import { showAlert } from '../utils/alert';
import { maxWidth, spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { Dialog } from './ui';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';
import { MonthFinanceChart, MonthFinancePoint } from './MonthFinanceChart';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['investment_spend', 'daily', 'one_time', 'other'];
const BUDGET_ITEM_STATUSES: BudgetItemStatus[] = ['not_started', 'awaiting_payment', 'completed'];

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

type FeedEntry =
  | {
      kind: 'expense';
      id: string;
      amount: number;
      description: string;
      date: string;
      category: ExpenseCategory;
      deletedAt: string | null;
      deletedReason: string | null;
      raw: ProjectExpense;
    }
  | {
      kind: 'income';
      id: string;
      amount: number;
      description: string;
      date: string;
      deletedAt: string | null;
      deletedReason: string | null;
      raw: ProjectIncome;
    };

interface Props {
  projectId: string;
  canEdit: boolean;
  ticketsSold: number;
  totalTickets: number;
  myTicketQuantity?: number;
}

type Tab = 'journal' | 'reports' | 'budget';

export function ProjectFinancePanel({ projectId, canEdit, ticketsSold, totalTickets, myTicketQuantity = 0 }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('journal');
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [incomes, setIncomes] = useState<ProjectIncome[]>([]);
  const [reports, setReports] = useState<ProjectFinancialReport[]>([]);
  const [budgetItems, setBudgetItems] = useState<ProjectBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(currentPeriod());

  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [entryKind, setEntryKind] = useState<'expense' | 'income'>('expense');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryCategory, setEntryCategory] = useState<ExpenseCategory>('other');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());

  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FeedEntry | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [chartWidth, setChartWidth] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expensesData, incomesData, reportsData, budgetItemsData] = await Promise.all([
        fetchProjectExpenses(projectId),
        fetchProjectIncomes(projectId),
        fetchProjectFinancialReports(projectId),
        fetchProjectBudgetItems(projectId),
      ]);
      setExpenses(expensesData);
      setIncomes(incomesData);
      setReports(reportsData);
      setBudgetItems(budgetItemsData);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- derived state ----

  const monthEntries = useMemo<FeedEntry[]>(() => {
    const list: FeedEntry[] = [
      ...expenses
        .filter((e) => e.date.slice(0, 7) === selectedMonth)
        .map<FeedEntry>((e) => ({
          kind: 'expense',
          id: e.id,
          amount: parseFloat(e.amount),
          description: e.description,
          date: e.date,
          category: e.category,
          deletedAt: e.deletedAt ?? null,
          deletedReason: e.deletedReason ?? null,
          raw: e,
        })),
      ...incomes
        .filter((e) => e.date.slice(0, 7) === selectedMonth)
        .map<FeedEntry>((e) => ({
          kind: 'income',
          id: e.id,
          amount: parseFloat(e.amount),
          description: e.description,
          date: e.date,
          deletedAt: e.deletedAt ?? null,
          deletedReason: e.deletedReason ?? null,
          raw: e,
        })),
    ];
    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses, incomes, selectedMonth]);

  const entriesByDay = useMemo(() => {
    const groups: Array<{ date: string; entries: FeedEntry[] }> = [];
    for (const entry of monthEntries) {
      const last = groups[groups.length - 1];
      if (last && last.date === entry.date) {
        last.entries.push(entry);
      } else {
        groups.push({ date: entry.date, entries: [entry] });
      }
    }
    return groups;
  }, [monthEntries]);

  // Deleted entries stay visible as history but no longer count toward the books.
  const monthIncome = monthEntries.reduce((sum, e) => (e.kind === 'income' && !e.deletedAt ? sum + e.amount : sum), 0);
  const monthExpenses = monthEntries.reduce((sum, e) => (e.kind === 'expense' && !e.deletedAt ? sum + e.amount : sum), 0);
  const monthNet = monthIncome - monthExpenses;

  const monthReport = reports.find((r) => r.period === selectedMonth) ?? null;
  const monthIsOpen = !monthReport;
  const isCurrentMonth = selectedMonth === currentPeriod();

  // Freshness: days since the founder last touched the books (any month).
  const lastEntryAt = useMemo(() => {
    let last: number | null = null;
    for (const e of [...expenses, ...incomes]) {
      const ts = new Date(e.createdAt).getTime();
      if (last === null || ts > last) last = ts;
    }
    return last;
  }, [expenses, incomes]);
  const freshnessDays = lastEntryAt === null ? null : Math.floor((Date.now() - lastEntryAt) / (24 * 60 * 60 * 1000));
  const freshnessColor =
    freshnessDays === null ? colors.textMuted : freshnessDays <= 3 ? colors.success : freshnessDays <= 7 ? colors.warning : colors.danger;

  const investorPoolEstimate = totalTickets > 0 && monthNet > 0 ? (monthNet * ticketsSold) / totalTickets : 0;

  // The date of the very first entry — before the books existed, missing days
  // shouldn't count as "skipped".
  const firstActivityDate = useMemo(() => {
    let min: string | null = null;
    for (const e of [...expenses, ...incomes]) {
      if (min === null || e.date < min) min = e.date;
    }
    return min;
  }, [expenses, incomes]);

  // Per-day bookkeeping coverage for the selected month: which days have a live
  // entry, and which past days were skipped.
  const dailyActivity = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const today = todayIso();
    const activeDays = new Set<number>();
    for (const e of monthEntries) {
      if (!e.deletedAt) activeDays.add(Number(e.date.slice(8, 10)));
    }
    const days: { day: number; status: 'active' | 'missed' | 'future' }[] = [];
    let missed = 0;
    let active = 0;
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      let status: 'active' | 'missed' | 'future';
      if (activeDays.has(d)) {
        status = 'active';
        active += 1;
      } else if (iso < today && (firstActivityDate === null || iso >= firstActivityDate)) {
        status = 'missed';
        missed += 1;
      } else {
        status = 'future';
      }
      days.push({ day: d, status });
    }
    return { days, missed, active };
  }, [selectedMonth, monthEntries, firstActivityDate]);

  // Cumulative income and expense per day, for the monthly finance line chart.
  const financeChartPoints = useMemo<MonthFinancePoint[]>(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const incByDay = new Array<number>(lastDay + 1).fill(0);
    const expByDay = new Array<number>(lastDay + 1).fill(0);
    for (const e of monthEntries) {
      if (e.deletedAt) continue;
      const d = Number(e.date.slice(8, 10));
      if (e.kind === 'income') incByDay[d] += e.amount;
      else expByDay[d] += e.amount;
    }
    const points: MonthFinancePoint[] = [];
    let cumIncome = 0;
    let cumExpense = 0;
    for (let d = 1; d <= lastDay; d++) {
      cumIncome += incByDay[d];
      cumExpense += expByDay[d];
      points.push({ day: d, income: cumIncome, expense: cumExpense });
    }
    return points;
  }, [selectedMonth, monthEntries]);

  const hasMonthData = monthIncome > 0 || monthExpenses > 0;

  // ---- actions ----

  const openEntryModal = (kind: 'expense' | 'income') => {
    setEntryKind(kind);
    setEntryAmount('');
    setEntryDescription('');
    setEntryCategory('other');
    setEntryDate(isCurrentMonth ? todayIso() : `${selectedMonth}-01`);
    setEntryModalVisible(true);
  };

  const handleSaveEntry = async () => {
    const amount = parseFloat(entryAmount);
    if (!amount || amount <= 0 || !entryDescription.trim()) {
      showAlert(t('common.error'));
      return;
    }
    setSubmitting(true);
    try {
      if (entryKind === 'expense') {
        await addProjectExpense(projectId, {
          amount,
          category: entryCategory,
          description: entryDescription.trim(),
          date: entryDate,
        });
      } else {
        await addProjectIncome(projectId, { amount, description: entryDescription.trim(), date: entryDate });
      }
      setEntryModalVisible(false);
      setSelectedMonth(entryDate.slice(0, 7));
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteEntryModal = (entry: FeedEntry) => {
    setDeleteTarget(entry);
    setDeleteReason('');
  };

  const handleConfirmDeleteEntry = async () => {
    if (!deleteTarget) return;
    const reason = deleteReason.trim();
    if (reason.length < 3) {
      showAlert(t('common.error'), t('project.finance.deleteReasonRequired'));
      return;
    }
    setSubmitting(true);
    try {
      if (deleteTarget.kind === 'expense') {
        await deleteProjectExpense(projectId, deleteTarget.id, reason);
      } else {
        await deleteProjectIncome(projectId, deleteTarget.id, reason);
      }
      setDeleteTarget(null);
      setDeleteReason('');
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const openCloseMonthModal = async () => {
    setCloseModalVisible(true);
    setWalletBalance(null);
    try {
      const wallet = await fetchWallet();
      setWalletBalance(parseFloat(wallet.balance));
    } catch {
      // balance stays unknown; publishing is still possible
    }
  };

  const handlePublishReport = async () => {
    setSubmitting(true);
    try {
      await addProjectFinancialReport(projectId, { period: selectedMonth });
      setCloseModalVisible(false);
      await load();
      setTab('reports');
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayReport = (report: ProjectFinancialReport) => {
    const estimate = totalTickets > 0 ? (report.netProfit * ticketsSold) / totalTickets : 0;
    showAlert(
      t('project.finance.payDividends'),
      t('project.finance.confirmPayMessage', {
        amount: `${estimate.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t('common.currency')}`,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setSubmitting(true);
            try {
              await payProjectFinancialReport(projectId, report.id);
              await load();
            } catch (err: any) {
              showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const handleDeleteReport = (report: ProjectFinancialReport) => {
    showAlert(t('common.confirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProjectFinancialReport(projectId, report.id);
            load();
          } catch (err: any) {
            showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
          }
        },
      },
    ]);
  };

  const handleChangeBudgetItemStatus = async (item: ProjectBudgetItem, status: BudgetItemStatus) => {
    if (status === item.status) return;
    await updateProjectBudgetItemStatus(projectId, item.id, status);
    load();
  };

  const handleRequestRelease = (item: ProjectBudgetItem) => {
    showAlert(t('project.finance.requestReleaseConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await requestRelease(projectId, { budgetItemId: item.id });
            showAlert(t('project.finance.releaseRequested'));
          } catch (err: any) {
            showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
          }
        },
      },
    ]);
  };

  // ---- render helpers ----

  const renderStatusChip = (report: ProjectFinancialReport | null) => {
    if (!report) {
      return (
        <View style={[styles.monthChip, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.monthChipText, { color: colors.primary }]}>{t('project.finance.monthOpen')}</Text>
        </View>
      );
    }
    const paid = report.status === 'paid';
    return (
      <View style={[styles.monthChip, { backgroundColor: paid ? colors.successSoft : colors.warningSoft }]}>
        <Text style={[styles.monthChipText, { color: paid ? colors.success : colors.warning }]}>
          {t(paid ? 'project.finance.monthPaid' : 'project.finance.monthPublished')}
        </Text>
      </View>
    );
  };

  const TABS: { key: Tab; label: string; caption: string }[] = [
    { key: 'journal', label: t('project.finance.journalTab'), caption: t('project.finance.journalCaption') },
    { key: 'reports', label: t('project.finance.reportsTab'), caption: t('project.finance.reportsCaption') },
    { key: 'budget', label: t('project.finance.budgetTab'), caption: t('project.finance.budgetCaption') },
  ];

  return (
    <View>
      <View style={styles.tabs}>
        {TABS.map(({ key, label }) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.tabCaption}>{TABS.find((item) => item.key === tab)?.caption}</Text>

      {tab === 'journal' && (
        <View>
          <View style={styles.freshnessRow}>
            <View style={[styles.freshnessDot, { backgroundColor: freshnessColor }]} />
            <Text style={styles.freshnessText}>
              {freshnessDays === null
                ? t('project.finance.noEntriesYet')
                : freshnessDays === 0
                  ? t('project.finance.updatedToday')
                  : t('project.finance.updatedDaysAgo', { count: freshnessDays })}
            </Text>
          </View>

          <View style={styles.monthRow}>
            <Pressable style={styles.monthArrow} onPress={() => setSelectedMonth(shiftPeriod(selectedMonth, -1))}>
              <Text style={styles.monthArrowText}>‹</Text>
            </Pressable>
            <View style={styles.monthCenter}>
              <Text style={styles.monthTitle}>{formatMonth(selectedMonth, i18n.language)}</Text>
              {renderStatusChip(monthReport)}
            </View>
            <Pressable
              style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
              disabled={isCurrentMonth}
              onPress={() => setSelectedMonth(shiftPeriod(selectedMonth, 1))}
            >
              <Text style={styles.monthArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('project.finance.incomesTab')}</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{monthIncome.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('project.finance.expensesTab')}</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>{monthExpenses.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t('project.finance.netProfitLabel')}</Text>
              <Text style={[styles.summaryValue, { color: monthNet >= 0 ? colors.text : colors.danger }]}>
                {monthNet.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.activityCard}>
            {/* Daily bookkeeping coverage — one square per day of the month */}
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>{t('project.finance.dailyActivityTitle')}</Text>
              <Text style={[styles.activityMissed, { color: dailyActivity.missed > 0 ? colors.danger : colors.success }]}>
                {dailyActivity.missed > 0
                  ? t('project.finance.missedDays', { count: dailyActivity.missed })
                  : t('project.finance.noMissedDays')}
              </Text>
            </View>
            <View style={styles.stripRow}>
              {dailyActivity.days.map((d) => (
                <View
                  key={d.day}
                  style={[
                    styles.stripCell,
                    d.status === 'active'
                      ? styles.stripCellActive
                      : d.status === 'missed'
                        ? styles.stripCellMissed
                        : styles.stripCellFuture,
                  ]}
                />
              ))}
            </View>
            <View style={styles.stripAxis}>
              <Text style={styles.stripAxisText}>1</Text>
              <Text style={styles.stripAxisText}>{dailyActivity.days.length}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>{t('project.finance.legendLogged')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotMissed]} />
                <Text style={styles.legendText}>{t('project.finance.legendMissed')}</Text>
              </View>
            </View>

            {/* Monthly finance line chart — cumulative income vs expenses */}
            <View style={styles.chartDivider} />
            <View style={styles.chartHeader}>
              <Text style={styles.activityTitle}>{t('project.finance.financeChartTitle')}</Text>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>{t('project.finance.incomesTab')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                  <Text style={styles.legendText}>{t('project.finance.expensesTab')}</Text>
                </View>
              </View>
            </View>
            <View onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
              {hasMonthData && chartWidth > 0 ? (
                <MonthFinanceChart points={financeChartPoints} width={chartWidth} />
              ) : (
                <Text style={styles.chartEmpty}>{t('project.finance.noEntriesMonth')}</Text>
              )}
            </View>
          </View>

          {!monthIsOpen && <Text style={styles.lockedNote}>{t('project.finance.monthClosedNote')}</Text>}

          {canEdit && monthIsOpen && (
            <View style={styles.actionsRow}>
              <View style={styles.actionButton}>
                <PrimaryButton title={t('project.finance.addEntry')} onPress={() => openEntryModal('expense')} />
              </View>
              <Pressable style={styles.closeMonthButton} onPress={openCloseMonthModal}>
                <Text style={styles.closeMonthButtonText}>{t('project.finance.closeMonth')}</Text>
              </Pressable>
            </View>
          )}

          {!loading && monthEntries.length === 0 && (
            <Text style={styles.empty}>{t('project.finance.noEntriesMonth')}</Text>
          )}
          {entriesByDay.map((group) => (
            <View key={group.date}>
              <Text style={styles.dayHeader}>{formatDate(group.date, i18n.language)}</Text>
              {group.entries.map((entry) => {
                const isDeleted = !!entry.deletedAt;
                return (
                  <View key={`${entry.kind}-${entry.id}`} style={styles.row}>
                    <View style={styles.rowMain}>
                      <View style={styles.rowAmountLine}>
                        <Text
                          style={[
                            styles.rowAmount,
                            { color: entry.kind === 'income' ? colors.success : colors.danger },
                            isDeleted && styles.deletedText,
                          ]}
                        >
                          {entry.kind === 'income' ? '+' : '−'}
                          {entry.amount.toLocaleString()} {t('common.currency')}
                        </Text>
                        {isDeleted && (
                          <View style={styles.deletedBadge}>
                            <Text style={styles.deletedBadgeText}>{t('project.finance.deletedBadge')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.rowDescription, isDeleted && styles.deletedText]}>{entry.description}</Text>
                      {entry.kind === 'expense' && (
                        <Text style={[styles.rowMeta, isDeleted && styles.deletedText]}>
                          {t(`project.finance.category.${entry.category}`)}
                        </Text>
                      )}
                      {isDeleted && entry.deletedReason && (
                        <Text style={styles.deletedReason}>
                          {t('project.finance.deletedReasonLabel')}: {entry.deletedReason}
                        </Text>
                      )}
                    </View>
                    {canEdit && monthIsOpen && !isDeleted && (
                      <Pressable onPress={() => openDeleteEntryModal(entry)} hitSlop={10}>
                        <Text style={styles.deleteLink}>{t('common.delete')}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {tab === 'reports' && (
        <View>
          {!loading && reports.length === 0 && <Text style={styles.empty}>{t('project.finance.noReports')}</Text>}
          {reports.map((report) => {
            const isPaid = report.status === 'paid';
            const myEstimate =
              !isPaid && totalTickets > 0 && myTicketQuantity > 0 && report.netProfit > 0
                ? (myTicketQuantity / totalTickets) * report.netProfit
                : null;
            return (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportPeriod}>{formatMonth(report.period, i18n.language)}</Text>
                  {renderStatusChip(report)}
                </View>
                <View style={styles.reportLine}>
                  <Text style={styles.reportLineLabel}>{t('project.finance.turnoverLabel')}</Text>
                  <Text style={styles.reportLineValue}>
                    {report.turnoverAmount.toLocaleString()} {t('common.currency')}
                  </Text>
                </View>
                <View style={styles.reportLine}>
                  <Text style={styles.reportLineLabel}>{t('project.finance.expensesLabel')}</Text>
                  <Text style={styles.reportLineValue}>
                    {report.expensesAmount.toLocaleString()} {t('common.currency')}
                  </Text>
                </View>
                <View style={styles.reportLine}>
                  <Text style={[styles.reportLineLabel, styles.reportNetLabel]}>{t('project.finance.netProfitLabel')}</Text>
                  <Text style={[styles.reportLineValue, { color: report.netProfit >= 0 ? colors.success : colors.danger }]}>
                    {report.netProfit.toLocaleString()} {t('common.currency')}
                  </Text>
                </View>
                {isPaid && report.payoutTotal !== null && (
                  <View style={styles.reportLine}>
                    <Text style={styles.reportLineLabel}>{t('project.finance.payoutTotalLabel')}</Text>
                    <Text style={[styles.reportLineValue, { color: colors.primary }]}>
                      {report.payoutTotal.toLocaleString()} {t('common.currency')}
                    </Text>
                  </View>
                )}
                {report.myDividend !== null && (
                  <View style={styles.reportLine}>
                    <Text style={styles.reportLineLabel}>{t('project.finance.myDividendLabel')}</Text>
                    <Text style={[styles.reportLineValue, { color: colors.primary }]}>
                      +{report.myDividend.toLocaleString()} {t('common.currency')}
                    </Text>
                  </View>
                )}
                {!isPaid && myEstimate !== null && (
                  <View style={styles.reportLine}>
                    <Text style={styles.reportLineLabel}>{t('project.finance.myShareLabel')}</Text>
                    <Text style={styles.reportLineValue}>
                      ≈{myEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('common.currency')}
                    </Text>
                  </View>
                )}
                {canEdit && !isPaid && (
                  <View style={styles.reportActions}>
                    {report.netProfit > 0 && (
                      <View style={styles.reportPayButton}>
                        <PrimaryButton
                          title={t('project.finance.payDividends')}
                          onPress={() => handlePayReport(report)}
                          loading={submitting}
                        />
                      </View>
                    )}
                    <Pressable onPress={() => handleDeleteReport(report)} hitSlop={10}>
                      <Text style={styles.deleteLink}>{t('common.delete')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {tab === 'budget' && (
        <View>
          {!loading && budgetItems.length === 0 && (
            <Text style={styles.empty}>{t('project.finance.noBudgetItems')}</Text>
          )}
          {budgetItems.map((item) => (
            <View key={item.id} style={styles.budgetRow}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {parseFloat(item.amount).toLocaleString()} {t('common.currency')}
                </Text>
              </View>
              {canEdit ? (
                <View style={styles.statusChipRow}>
                  {BUDGET_ITEM_STATUSES.map((status) => (
                    <Pressable
                      key={status}
                      style={[styles.statusChip, item.status === status && styles.statusChipActive]}
                      onPress={() => handleChangeBudgetItemStatus(item, status)}
                    >
                      <Text style={[styles.statusChipText, item.status === status && styles.statusChipTextActive]}>
                        {t(`project.finance.status.${status}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.statusBadge}>{t(`project.finance.status.${item.status}`)}</Text>
              )}
              {canEdit &&
                (item.released ? (
                  <Text style={styles.releasedBadge}>✓ {t('project.finance.released')}</Text>
                ) : (
                  <Pressable style={styles.releaseButton} onPress={() => handleRequestRelease(item)}>
                    <Text style={styles.releaseButtonText}>{t('project.finance.requestRelease')}</Text>
                  </Pressable>
                ))}
            </View>
          ))}
        </View>
      )}

      {/* Add entry modal */}
      <Dialog visible={entryModalVisible} onClose={() => setEntryModalVisible(false)} maxWidth={maxWidth.dialogMd}>
        <View style={styles.modalCard}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{t('project.finance.addEntry')}</Text>
            <View style={styles.kindRow}>
              {(['expense', 'income'] as const).map((kind) => (
                <Pressable
                  key={kind}
                  style={[styles.kindChip, entryKind === kind && styles.kindChipActive]}
                  onPress={() => setEntryKind(kind)}
                >
                  <Text style={[styles.kindChipText, entryKind === kind && styles.kindChipTextActive]}>
                    {t(kind === 'expense' ? 'project.finance.expensesTab' : 'project.finance.incomesTab')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextField
              label={t('project.finance.amountLabel')}
              value={entryAmount}
              onChangeText={setEntryAmount}
              format="decimal"
              keyboardType="decimal-pad"
            />
            {entryKind === 'expense' && (
              <View style={styles.categoryRow}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    style={[styles.categoryChip, entryCategory === category && styles.categoryChipActive]}
                    onPress={() => setEntryCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, entryCategory === category && styles.categoryChipTextActive]}>
                      {t(`project.finance.category.${category}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <TextField
              label={t('project.finance.descriptionLabel')}
              value={entryDescription}
              onChangeText={setEntryDescription}
            />
            <TextField
              label={t('project.finance.dateLabel')}
              value={entryDate}
              onChangeText={setEntryDate}
              format="date"
              placeholder="YYYY-MM-DD"
            />
            <PrimaryButton title={t('common.save')} onPress={handleSaveEntry} loading={submitting} />
            <Pressable style={styles.modalCancel} onPress={() => setEntryModalVisible(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Dialog>

      {/* Close month modal */}
      <Dialog visible={closeModalVisible} onClose={() => setCloseModalVisible(false)} maxWidth={maxWidth.dialogMd}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {t('project.finance.closeMonth')} · {formatMonth(selectedMonth, i18n.language)}
          </Text>
          {isCurrentMonth && <Text style={styles.warningNote}>{t('project.finance.closeMonthCurrentWarning')}</Text>}
          <View style={styles.reportLine}>
            <Text style={styles.reportLineLabel}>{t('project.finance.incomesTab')}</Text>
            <Text style={styles.reportLineValue}>
              {monthIncome.toLocaleString()} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.reportLine}>
            <Text style={styles.reportLineLabel}>{t('project.finance.expensesTab')}</Text>
            <Text style={styles.reportLineValue}>
              {monthExpenses.toLocaleString()} {t('common.currency')}
            </Text>
          </View>
          <View style={styles.reportLine}>
            <Text style={[styles.reportLineLabel, styles.reportNetLabel]}>{t('project.finance.netProfitLabel')}</Text>
            <Text style={[styles.reportLineValue, { color: monthNet >= 0 ? colors.success : colors.danger }]}>
              {monthNet.toLocaleString()} {t('common.currency')}
            </Text>
          </View>
          {monthNet > 0 && (
            <>
              <View style={styles.reportLine}>
                <Text style={styles.reportLineLabel}>{t('project.finance.toInvestors')}</Text>
                <Text style={styles.reportLineValue}>
                  ≈{investorPoolEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('common.currency')}
                </Text>
              </View>
              <View style={styles.reportLine}>
                <Text style={styles.reportLineLabel}>{t('project.finance.founderKeeps')}</Text>
                <Text style={styles.reportLineValue}>
                  ≈{(monthNet - investorPoolEstimate).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                  {t('common.currency')}
                </Text>
              </View>
              {walletBalance !== null && (
                <View style={styles.reportLine}>
                  <Text style={styles.reportLineLabel}>{t('project.finance.walletBalance')}</Text>
                  <Text
                    style={[
                      styles.reportLineValue,
                      { color: walletBalance >= investorPoolEstimate ? colors.success : colors.danger },
                    ]}
                  >
                    {walletBalance.toLocaleString()} {t('common.currency')}
                  </Text>
                </View>
              )}
            </>
          )}
          <Text style={styles.closeMonthNote}>{t('project.finance.closeMonthNote')}</Text>
          <PrimaryButton title={t('project.finance.publishReport')} onPress={handlePublishReport} loading={submitting} />
          <Pressable style={styles.modalCancel} onPress={() => setCloseModalVisible(false)}>
            <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Dialog>

      {/* Delete entry (with reason) modal */}
      <Dialog visible={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth={maxWidth.dialogMd}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('project.finance.deleteEntryTitle')}</Text>
          {deleteTarget && (
            <View style={styles.deleteSummary}>
              <Text
                style={[
                  styles.rowAmount,
                  { color: deleteTarget.kind === 'income' ? colors.success : colors.danger },
                ]}
              >
                {deleteTarget.kind === 'income' ? '+' : '−'}
                {deleteTarget.amount.toLocaleString()} {t('common.currency')}
              </Text>
              <Text style={styles.rowDescription}>{deleteTarget.description}</Text>
            </View>
          )}
          <Text style={styles.deleteNote}>{t('project.finance.deleteEntryNote')}</Text>
          <TextField
            label={t('project.finance.deletedReasonLabel')}
            value={deleteReason}
            onChangeText={setDeleteReason}
          />
          <PrimaryButton title={t('common.delete')} onPress={handleConfirmDeleteEntry} loading={submitting} />
          <Pressable style={styles.modalCancel} onPress={() => setDeleteTarget(null)}>
            <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Dialog>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      backgroundColor: c.background,
      borderRadius: 10,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: 8,
    },
    tabActive: {
      backgroundColor: c.surface,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
    },
    tabTextActive: {
      color: c.primary,
    },
    tabCaption: {
      fontSize: 12,
      color: c.textMuted,
      fontStyle: 'italic',
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    freshnessRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    freshnessDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.xs,
    },
    freshnessText: {
      fontSize: 12,
      color: c.textMuted,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    monthArrow: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthArrowDisabled: {
      opacity: 0.35,
    },
    monthArrowText: {
      fontSize: 20,
      color: c.text,
      lineHeight: 22,
    },
    monthCenter: {
      alignItems: 'center',
    },
    monthTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      textTransform: 'capitalize',
    },
    monthChip: {
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginTop: 4,
    },
    monthChipText: {
      fontSize: 11,
      fontWeight: '700',
    },
    summaryRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: c.background,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      marginHorizontal: 2,
    },
    summaryLabel: {
      fontSize: 11,
      color: c.textMuted,
      fontWeight: '600',
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 2,
    },
    lockedNote: {
      fontSize: 12,
      color: c.warning,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    activityCard: {
      backgroundColor: c.background,
      borderRadius: 12,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    activityTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
    },
    activityMissed: {
      fontSize: 12,
      fontWeight: '600',
    },
    stripRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    stripCell: {
      flex: 1,
      height: 18,
      borderRadius: 3,
      borderWidth: 1,
      marginHorizontal: 1,
    },
    stripCellActive: {
      backgroundColor: c.success,
      borderColor: c.success,
    },
    stripCellMissed: {
      backgroundColor: c.dangerSoft,
      borderColor: c.danger,
    },
    stripCellFuture: {
      backgroundColor: c.surface,
      borderColor: c.border,
    },
    stripAxis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 3,
    },
    stripAxisText: {
      fontSize: 10,
      color: c.textMuted,
    },
    chartDivider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: spacing.md,
    },
    chartHeader: {
      marginBottom: spacing.xs,
    },
    chartEmpty: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 13,
      paddingVertical: spacing.lg,
    },
    legendRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 3,
      marginRight: 4,
    },
    legendDotMissed: {
      backgroundColor: c.dangerSoft,
      borderWidth: 1,
      borderColor: c.danger,
    },
    legendText: {
      fontSize: 11,
      color: c.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    actionButton: {
      flex: 1,
      marginRight: spacing.sm,
    },
    closeMonthButton: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    closeMonthButtonText: {
      color: c.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    dayHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      marginTop: spacing.sm,
      marginBottom: 2,
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      paddingVertical: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    budgetRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowMain: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
    },
    rowAmount: {
      fontSize: 15,
      fontWeight: '700',
    },
    rowMeta: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    rowDescription: {
      fontSize: 13,
      color: c.text,
      marginTop: 2,
    },
    deleteLink: {
      fontSize: 12,
      fontWeight: '600',
      color: c.danger,
      marginLeft: spacing.sm,
    },
    rowAmountLine: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    deletedText: {
      textDecorationLine: 'line-through',
      color: c.textMuted,
    },
    deletedBadge: {
      backgroundColor: c.dangerSoft,
      borderRadius: 6,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      marginLeft: spacing.sm,
    },
    deletedBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.danger,
      textTransform: 'uppercase',
    },
    deletedReason: {
      fontSize: 12,
      color: c.textMuted,
      fontStyle: 'italic',
      marginTop: 3,
    },
    deleteSummary: {
      backgroundColor: c.background,
      borderRadius: 10,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    deleteNote: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    reportCard: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: c.surface,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    reportPeriod: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      textTransform: 'capitalize',
    },
    reportLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    reportLineLabel: {
      fontSize: 13,
      color: c.textMuted,
    },
    reportNetLabel: {
      fontWeight: '700',
      color: c.text,
    },
    reportLineValue: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
    },
    reportActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    reportPayButton: {
      flex: 1,
      marginRight: spacing.sm,
    },
    statusChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: spacing.xs,
    },
    statusChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
    },
    statusChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    statusChipText: {
      fontSize: 11,
      color: c.textMuted,
      fontWeight: '600',
    },
    statusChipTextActive: {
      color: c.textOnAccent,
    },
    statusBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: c.primary,
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
      backgroundColor: c.background,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    releasedBadge: {
      fontSize: 12,
      fontWeight: '700',
      color: c.success,
      marginTop: spacing.xs,
    },
    releaseButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    releaseButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.primary,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.md,
    },
    categoryChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
    },
    categoryChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    categoryChipText: {
      fontSize: 12,
      color: c.textMuted,
      fontWeight: '600',
    },
    categoryChipTextActive: {
      color: c.textOnAccent,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: spacing.lg,
      width: '100%',
      // Dialog caps the height; without this the card would keep its full content height
      // and spill past that cap instead of letting its ScrollView take over.
      flexShrink: 1,
      alignSelf: 'center',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    kindRow: {
      flexDirection: 'row',
      backgroundColor: c.background,
      borderRadius: 10,
      padding: 4,
      marginBottom: spacing.md,
    },
    kindChip: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: 8,
    },
    kindChipActive: {
      backgroundColor: c.surface,
    },
    kindChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
    },
    kindChipTextActive: {
      color: c.primary,
    },
    warningNote: {
      fontSize: 12,
      color: c.warning,
      marginBottom: spacing.sm,
    },
    closeMonthNote: {
      fontSize: 12,
      color: c.textMuted,
      marginVertical: spacing.md,
    },
    modalCancel: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    modalCancelText: {
      color: c.textMuted,
      fontWeight: '600',
      fontSize: 14,
    },
  });
