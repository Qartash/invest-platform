import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BudgetItemStatus, ExpenseCategory, ProjectBudgetItem, ProjectExpense, ProjectFinancialReport, ProjectIncome } from '../types';
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
} from '../api/projectFinance';
import { fetchProjectBudgetItems, updateProjectBudgetItemStatus } from '../api/projects';
import { formatDate } from '../utils/date';
import { showAlert } from '../utils/alert';
import { colors, spacing } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['investment_spend', 'daily', 'one_time', 'other'];
const BUDGET_ITEM_STATUSES: BudgetItemStatus[] = ['not_started', 'awaiting_payment', 'completed'];

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  projectId: string;
  canEdit: boolean;
  ticketsSold: number;
  myTicketQuantity?: number;
}

type Tab = 'expenses' | 'incomes' | 'reports' | 'budget';

export function ProjectFinancePanel({ projectId, canEdit, ticketsSold, myTicketQuantity = 0 }: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('expenses');
  const [tabsContainerWidth, setTabsContainerWidth] = useState(0);
  const [tabsContentWidth, setTabsContentWidth] = useState(0);
  const [tabsScrollX, setTabsScrollX] = useState(0);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [incomes, setIncomes] = useState<ProjectIncome[]>([]);
  const [reports, setReports] = useState<ProjectFinancialReport[]>([]);
  const [budgetItems, setBudgetItems] = useState<ProjectBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('other');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());

  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDescription, setIncomeDescription] = useState('');
  const [incomeDate, setIncomeDate] = useState(todayIso());

  const [reportPeriod, setReportPeriod] = useState(currentPeriod());

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

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseAmount);
    if (!amount || amount <= 0 || !expenseDescription.trim()) {
      showAlert(t('common.error'));
      return;
    }
    setSubmitting(true);
    try {
      await addProjectExpense(projectId, {
        amount,
        category: expenseCategory,
        description: expenseDescription.trim(),
        date: expenseDate,
      });
      setExpenseAmount('');
      setExpenseDescription('');
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (expense: ProjectExpense) => {
    showAlert(t('common.confirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteProjectExpense(projectId, expense.id);
          load();
        },
      },
    ]);
  };

  const handleAddIncome = async () => {
    const amount = parseFloat(incomeAmount);
    if (!amount || amount <= 0 || !incomeDescription.trim()) {
      showAlert(t('common.error'));
      return;
    }
    setSubmitting(true);
    try {
      await addProjectIncome(projectId, { amount, description: incomeDescription.trim(), date: incomeDate });
      setIncomeAmount('');
      setIncomeDescription('');
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteIncome = (income: ProjectIncome) => {
    showAlert(t('common.confirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteProjectIncome(projectId, income.id);
          load();
        },
      },
    ]);
  };

  const handleAddReport = async () => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reportPeriod)) {
      showAlert(t('common.error'));
      return;
    }
    setSubmitting(true);
    try {
      await addProjectFinancialReport(projectId, { period: reportPeriod });
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReport = (report: ProjectFinancialReport) => {
    showAlert(t('common.confirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteProjectFinancialReport(projectId, report.id);
          load();
        },
      },
    ]);
  };

  const handleChangeBudgetItemStatus = async (item: ProjectBudgetItem, status: BudgetItemStatus) => {
    if (status === item.status) return;
    await updateProjectBudgetItemStatus(projectId, item.id, status);
    load();
  };

  const TABS: { key: Tab; label: string; caption: string }[] = [
    { key: 'expenses', label: t('project.finance.expensesTab'), caption: t('project.finance.expensesCaption') },
    { key: 'incomes', label: t('project.finance.incomesTab'), caption: t('project.finance.incomesCaption') },
    { key: 'reports', label: t('project.finance.reportsTab'), caption: t('project.finance.reportsCaption') },
    { key: 'budget', label: t('project.finance.budgetTab'), caption: t('project.finance.budgetCaption') },
  ];
  const canScrollTabs = tabsContentWidth > tabsContainerWidth + 1 && tabsScrollX < tabsContentWidth - tabsContainerWidth - 4;

  return (
    <View>
      <View style={styles.tabsWrapper} onLayout={(e) => setTabsContainerWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          onContentSizeChange={(w) => setTabsContentWidth(w)}
          onScroll={(e) => setTabsScrollX(e.nativeEvent.contentOffset.x)}
          scrollEventThrottle={32}
        >
          <View style={styles.tabs}>
            {TABS.map(({ key, label }) => (
              <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        {canScrollTabs && (
          <View pointerEvents="none" style={styles.tabsScrollHint}>
            <Text style={styles.tabsScrollHintArrow}>›</Text>
          </View>
        )}
      </View>
      <Text style={styles.tabCaption}>{TABS.find((t) => t.key === tab)?.caption}</Text>

      {tab === 'expenses' && (
        <View>
          {canEdit && (
            <View style={styles.form}>
              <TextField
                label={t('project.finance.amountLabel')}
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                format="decimal"
                keyboardType="decimal-pad"
              />
              <View style={styles.categoryRow}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    style={[styles.categoryChip, expenseCategory === category && styles.categoryChipActive]}
                    onPress={() => setExpenseCategory(category)}
                  >
                    <Text
                      style={[styles.categoryChipText, expenseCategory === category && styles.categoryChipTextActive]}
                    >
                      {t(`project.finance.category.${category}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextField
                label={t('project.finance.descriptionLabel')}
                value={expenseDescription}
                onChangeText={setExpenseDescription}
              />
              <TextField
                label={t('project.finance.dateLabel')}
                value={expenseDate}
                onChangeText={setExpenseDate}
                format="date"
                placeholder="YYYY-MM-DD"
              />
              <PrimaryButton
                title={t('project.finance.addExpense')}
                onPress={handleAddExpense}
                loading={submitting}
              />
              <View style={{ height: spacing.md }} />
            </View>
          )}
          {!loading && expenses.length === 0 && (
            <Text style={styles.empty}>{t('project.finance.noExpenses')}</Text>
          )}
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  {parseFloat(expense.amount).toLocaleString()} {t('common.currency')}
                </Text>
                <Text style={styles.rowMeta}>
                  {t(`project.finance.category.${expense.category}`)} · {formatDate(expense.date, i18n.language)}
                </Text>
                <Text style={styles.rowDescription}>{expense.description}</Text>
              </View>
              {canEdit && (
                <Pressable onPress={() => handleDeleteExpense(expense)} hitSlop={10}>
                  <Text style={styles.deleteLink}>{t('common.delete')}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {tab === 'incomes' && (
        <View>
          {canEdit && (
            <View style={styles.form}>
              <TextField
                label={t('project.finance.amountLabel')}
                value={incomeAmount}
                onChangeText={setIncomeAmount}
                format="decimal"
                keyboardType="decimal-pad"
              />
              <TextField
                label={t('project.finance.descriptionLabel')}
                value={incomeDescription}
                onChangeText={setIncomeDescription}
              />
              <TextField
                label={t('project.finance.dateLabel')}
                value={incomeDate}
                onChangeText={setIncomeDate}
                format="date"
                placeholder="YYYY-MM-DD"
              />
              <PrimaryButton title={t('project.finance.addIncome')} onPress={handleAddIncome} loading={submitting} />
              <View style={{ height: spacing.md }} />
            </View>
          )}
          {!loading && incomes.length === 0 && <Text style={styles.empty}>{t('project.finance.noIncomes')}</Text>}
          {incomes.map((income) => (
            <View key={income.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  {parseFloat(income.amount).toLocaleString()} {t('common.currency')}
                </Text>
                <Text style={styles.rowMeta}>{formatDate(income.date, i18n.language)}</Text>
                <Text style={styles.rowDescription}>{income.description}</Text>
              </View>
              {canEdit && (
                <Pressable onPress={() => handleDeleteIncome(income)} hitSlop={10}>
                  <Text style={styles.deleteLink}>{t('common.delete')}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {tab === 'reports' && (
        <View>
          {canEdit && (
            <View style={styles.form}>
              <TextField
                label={t('project.finance.periodLabel')}
                value={reportPeriod}
                onChangeText={setReportPeriod}
                format="date"
                placeholder="YYYY-MM"
              />
              <PrimaryButton title={t('project.finance.addReport')} onPress={handleAddReport} loading={submitting} />
              <View style={{ height: spacing.md }} />
            </View>
          )}
          {!loading && reports.length === 0 && <Text style={styles.empty}>{t('project.finance.noReports')}</Text>}
          {reports.map((report) => {
            const myShare =
              ticketsSold > 0 && myTicketQuantity > 0 ? (myTicketQuantity / ticketsSold) * report.netProfit : null;
            return (
              <View key={report.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{report.period}</Text>
                  <Text style={styles.rowMeta}>
                    {t('project.finance.turnoverLabel')}: {report.turnoverAmount.toLocaleString()}{' '}
                    {t('common.currency')}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {t('project.finance.expensesLabel')}: {report.expensesAmount.toLocaleString()}{' '}
                    {t('common.currency')}
                  </Text>
                  <Text style={styles.rowNetProfit}>
                    {t('project.finance.netProfitLabel')}: {report.netProfit.toLocaleString()} {t('common.currency')}
                  </Text>
                  {myShare !== null && (
                    <Text style={styles.rowShare}>
                      {t('project.finance.myShareLabel')}: {myShare.toLocaleString()} {t('common.currency')}
                    </Text>
                  )}
                </View>
                {canEdit && (
                  <Pressable onPress={() => handleDeleteReport(report)} hitSlop={10}>
                    <Text style={styles.deleteLink}>{t('common.delete')}</Text>
                  </Pressable>
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
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsWrapper: {
    position: 'relative',
  },
  tabsScroll: {
    marginBottom: 0,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabsScrollHint: {
    position: 'absolute',
    right: 0,
    top: 4,
    bottom: 4,
    width: 28,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: 'rgba(246,248,247,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScrollHintArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  tabCaption: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  form: {
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  budgetRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  rowDescription: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  rowNetProfit: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
    marginTop: 2,
  },
  rowShare: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  deleteLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  statusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#fff',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
