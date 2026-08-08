import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  fetchLedgerSummary,
  fetchMovements,
  fundPlatformAccount,
  LedgerAccount,
  LedgerSummary,
  Movement,
  MovementKind,
  MovementPage,
  MOVEMENT_KINDS,
} from '../../api/ledger';
import { invalidateQuery, useCachedQuery } from '../../api/useCachedQuery';
import { getLocalizedText } from '../../utils/localized';
import { formatDateTime } from '../../utils/date';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { Card, Dialog, PageContainer, SectionHeader } from '../../components/ui';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { LoadFailed } from '../../components/LoadFailed';
import {
  maxWidth,
  radius,
  spacing,
  tabularNums,
  ThemeColors,
  typography,
  useTheme,
  useThemeStyles,
} from '../../theme';

/**
 * Every movement of money on the platform, and the accounts it sits in.
 *
 * The point of the screen is that nothing is missing from it. Six of these
 * movements — stage releases, founder withdrawals, refunds, work escrow in and
 * out, the paying side of a dividend run — used to leave no record anywhere, so
 * a project's money appeared to sit still while it was actually being spent.
 */
export function ModerationFinanceScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [kind, setKind] = useState<MovementKind | 'all'>('all');
  const [page, setPage] = useState(1);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundNote, setFundNote] = useState('');
  const [funding, setFunding] = useState(false);

  const summaryQuery = useCachedQuery<LedgerSummary>('ledger:summary', fetchLedgerSummary);
  // Keyed by filter and page, so paging back to somewhere you have already been
  // redraws instead of emptying the list to fetch it again.
  const feedQuery = useCachedQuery<MovementPage>(
    `ledger:movements:${kind}:${page}`,
    useCallback(
      () => fetchMovements({ page, kind: kind === 'all' ? undefined : kind }),
      [page, kind],
    ),
  );

  const summary = summaryQuery.data;
  const feed = feedQuery.data;
  const movements = useMemo(() => feed?.items ?? [], [feed]);
  const pageCount = feed ? Math.max(1, Math.ceil(feed.total / feed.pageSize)) : 1;

  const currency = t('common.currency');
  const money = (v: number) => `${Math.round(v).toLocaleString()} ${currency}`;

  const reload = useCallback(() => {
    invalidateQuery('ledger');
    void summaryQuery.refresh();
    void feedQuery.refresh();
  }, [summaryQuery, feedQuery]);

  const submitFunding = async () => {
    const amount = parseFloat(fundAmount.replace(',', '.'));
    if (!(amount > 0)) return;
    setFunding(true);
    try {
      await fundPlatformAccount(amount, fundNote.trim() || undefined);
      setFundOpen(false);
      setFundAmount('');
      setFundNote('');
      reload();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setFunding(false);
    }
  };

  // What one end of a movement is, in words: a person's name, a project's title,
  // or the name of an account that belongs to nobody.
  const endLabel = (
    account: LedgerAccount,
    userName: string | null,
    username: string | null,
    projectTitle: unknown,
  ) => {
    const who = userName || username;
    switch (account) {
      case 'external':
      case 'platform':
        return t(`ledger.account.${account}`);
      case 'user_balance':
      case 'user_invest':
        return `${who ?? t('ledger.account.deletedUser')} · ${t(`ledger.account.${account}`)}`;
      default:
        return `${projectTitle ? getLocalizedText(projectTitle as never, i18n.language) : t('ledger.account.deletedProject')} · ${t(`ledger.account.${account}`)}`;
    }
  };

  const renderMovement = (movement: Movement) => (
    <Card key={movement.id} style={styles.movement}>
      <View style={styles.movementTop}>
        <Text style={styles.movementKind}>{t(`ledger.kind.${movement.kind}`)}</Text>
        <Text style={styles.movementAmount}>{money(movement.amount)}</Text>
      </View>
      <View style={styles.flowRow}>
        <Text style={styles.flowFrom} numberOfLines={2}>
          {endLabel(
            movement.fromAccount,
            movement.fromUserName,
            movement.fromUsername,
            movement.fromProjectTitle,
          )}
        </Text>
        <Text style={styles.flowArrow}>→</Text>
        <Text style={styles.flowTo} numberOfLines={2}>
          {endLabel(movement.toAccount, movement.toUserName, movement.toUsername, movement.toProjectTitle)}
        </Text>
      </View>
      <View style={styles.movementFoot}>
        <Text style={styles.movementDate}>{formatDateTime(movement.createdAt, i18n.language)}</Text>
        {!!movement.description && (
          <Text style={styles.movementNote} numberOfLines={1}>
            {movement.description}
          </Text>
        )}
      </View>
    </Card>
  );

  if (!summary && summaryQuery.error) {
    return (
      <ScrollView contentContainerStyle={styles.list}>
        <PageContainer maxWidth={maxWidth.page}>
          <LoadFailed onRetry={reload} />
        </PageContainer>
      </ScrollView>
    );
  }

  return (
    <>
    <FlatList
      data={movements}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <PageContainer maxWidth={maxWidth.page}>{renderMovement(item)}</PageContainer>
      )}
      ListHeaderComponent={
        <PageContainer maxWidth={maxWidth.page}>
          {/* The pool, first, because it is the one account an admin can act on. */}
          <Card accented style={styles.poolCard}>
            <View style={styles.poolTop}>
              <Text style={styles.poolLabel}>{t('ledger.poolTitle')}</Text>
              <Text style={styles.poolValue}>{money(summary?.platform ?? 0)}</Text>
            </View>
            <Text style={styles.poolHint}>{t('ledger.poolHint')}</Text>
            <Pressable style={styles.fundButton} onPress={() => setFundOpen(true)}>
              <Text style={styles.fundButtonText}>{t('ledger.fund')}</Text>
            </Pressable>
          </Card>

          <View style={styles.sectionHead}>


            <SectionHeader title={t('ledger.whereMoneyIs')} spaced />


          </View>
          <Card style={styles.sheet}>
            {(
              [
                ['userBalances', summary?.userBalances],
                ['userInvest', summary?.userInvest],
                ['projectTreasuries', summary?.projectTreasuries],
                ['projectSpendable', summary?.projectSpendable],
                ['workEscrow', summary?.workEscrow],
                ['platform', summary?.platform],
              ] as Array<[string, number | undefined]>
            ).map(([key, value]) => (
              <View key={key} style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>{t(`ledger.sheet.${key}`)}</Text>
                <Text style={styles.sheetValue}>{money(value ?? 0)}</Text>
              </View>
            ))}
            <View style={[styles.sheetRow, styles.sheetTotal]}>
              <Text style={styles.sheetTotalLabel}>{t('ledger.sheet.held')}</Text>
              <Text style={styles.sheetTotalValue}>{money(summary?.held ?? 0)}</Text>
            </View>
          </Card>

          <View style={styles.sectionHead}>


            <SectionHeader title={t('ledger.whereMoneyCameFrom')} spaced />


          </View>
          <Card style={styles.sheet}>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>{t('ledger.sheet.emittedIn')}</Text>
              <Text style={[styles.sheetValue, { color: colors.success }]}>
                {money(summary?.emittedIn ?? 0)}
              </Text>
            </View>
            <View style={styles.sheetRow}>
              <Text style={styles.sheetLabel}>{t('ledger.sheet.emittedOut')}</Text>
              <Text style={[styles.sheetValue, { color: colors.danger }]}>
                {money(summary?.emittedOut ?? 0)}
              </Text>
            </View>
            <View style={[styles.sheetRow, styles.sheetTotal]}>
              <Text style={styles.sheetTotalLabel}>{t('ledger.sheet.unaccounted')}</Text>
              <Text
                style={[
                  styles.sheetTotalValue,
                  { color: (summary?.unaccounted ?? 0) === 0 ? colors.success : colors.warning },
                ]}
              >
                {money(summary?.unaccounted ?? 0)}
              </Text>
            </View>
            <Text style={styles.note}>{t('ledger.unaccountedNote')}</Text>
          </Card>

          <View style={styles.sectionHead}>


            <SectionHeader title={t('ledger.movements')} spaced />


          </View>
          {/* Horizontal because there are sixteen of these and they must not wrap
              into a wall that pushes the feed off the screen. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {(['all', ...MOVEMENT_KINDS] as Array<MovementKind | 'all'>).map((option) => (
              <Pressable
                key={option}
                style={[styles.filter, kind === option && styles.filterActive]}
                onPress={() => {
                  setKind(option);
                  setPage(1);
                }}
              >
                <Text style={[styles.filterText, kind === option && styles.filterTextActive]}>
                  {option === 'all' ? t('ledger.allKinds') : t(`ledger.kind.${option}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </PageContainer>
      }
      ListEmptyComponent={
        feedQuery.loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <PageContainer maxWidth={maxWidth.page}>
            <Text style={styles.empty}>{t('ledger.noMovements')}</Text>
          </PageContainer>
        )
      }
      ListFooterComponent={
        pageCount > 1 ? (
          <PageContainer maxWidth={maxWidth.page}>
            <View style={styles.pager}>
              <Pressable
                style={[styles.pagerButton, page <= 1 && styles.pagerDisabled]}
                disabled={page <= 1}
                onPress={() => setPage((p) => p - 1)}
              >
                <Text style={styles.pagerText}>{t('ledger.prev')}</Text>
              </Pressable>
              <Text style={styles.pagerCount}>
                {page} / {pageCount}
              </Text>
              <Pressable
                style={[styles.pagerButton, page >= pageCount && styles.pagerDisabled]}
                disabled={page >= pageCount}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={styles.pagerText}>{t('ledger.next')}</Text>
              </Pressable>
            </View>
          </PageContainer>
        ) : null
      }
      ListHeaderComponentStyle={styles.header}
    />

    {/* Funding is money entering the platform from outside, so the note is the
        only thing that will ever say where from — a transfer reference, a budget
        line. Recorded as a movement like any other. */}
    <Dialog visible={fundOpen} onClose={() => setFundOpen(false)} dismissable={!funding}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>{t('ledger.fundTitle')}</Text>
        <Text style={styles.dialogText}>{t('ledger.fundText')}</Text>
        <TextField
          label={t('ledger.fundAmount')}
          value={fundAmount}
          onChangeText={setFundAmount}
          format="decimal"
          keyboardType="numeric"
          placeholder="0"
        />
        <TextField
          label={t('ledger.fundNote')}
          value={fundNote}
          onChangeText={setFundNote}
          placeholder={t('ledger.fundNotePlaceholder')}
        />
        <PrimaryButton
          title={t('ledger.fundConfirm')}
          onPress={submitFunding}
          loading={funding}
          disabled={!(parseFloat(fundAmount.replace(',', '.')) > 0)}
        />
        <Pressable style={styles.dialogCancel} onPress={() => setFundOpen(false)} disabled={funding}>
          <Text style={styles.dialogCancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Dialog>
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    list: { paddingVertical: spacing.md, paddingBottom: spacing.xl },
    header: { marginBottom: spacing.sm },

    poolCard: { marginHorizontal: spacing.md },
    poolTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    poolLabel: { ...typography.captionStrong, color: c.textMuted, flexShrink: 1 },
    poolValue: { ...typography.title, ...tabularNums, color: c.text },
    poolHint: { ...typography.micro, color: c.textMuted, lineHeight: 18, marginTop: spacing.xs },
    fundButton: {
      marginTop: spacing.md,
      height: 38,
      borderRadius: radius.lg,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fundButtonText: { ...typography.labelStrong, color: c.textOnAccent },

    // SectionHeader brings no horizontal padding of its own, so it needs the same
    // inset as the cards it introduces or it hangs off the left edge.
    sectionHead: { paddingHorizontal: spacing.md },
    sheet: { marginHorizontal: spacing.md },
    sheetRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
      paddingVertical: spacing.xs + 1,
    },
    sheetLabel: { ...typography.caption, color: c.textMuted, flexShrink: 1 },
    sheetValue: { ...typography.captionStrong, ...tabularNums, color: c.text },
    sheetTotal: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    sheetTotalLabel: { ...typography.captionStrong, color: c.text, flexShrink: 1 },
    sheetTotalValue: { ...typography.bodyStrong, ...tabularNums, color: c.text },
    note: { ...typography.micro, color: c.textMuted, lineHeight: 18, marginTop: spacing.sm },

    filters: { paddingHorizontal: spacing.md, gap: spacing.xs + 2, paddingVertical: spacing.xs },
    filter: {
      paddingHorizontal: spacing.sm + 2,
      height: 30,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSunken,
      justifyContent: 'center',
    },
    filterActive: { backgroundColor: c.primary, borderColor: 'transparent' },
    filterText: { ...typography.micro, color: c.textMuted },
    filterTextActive: { color: c.textOnAccent },

    movement: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
    movementTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    movementKind: { ...typography.captionStrong, color: c.text, flexShrink: 1 },
    movementAmount: { ...typography.bodyStrong, ...tabularNums, color: c.primary },
    // The two ends and the arrow between them are the row's reason to exist, so
    // they get their own line rather than being folded into the description.
    flowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      marginTop: spacing.xs + 2,
    },
    flowFrom: { ...typography.micro, color: c.textMuted, flex: 1 },
    flowArrow: { ...typography.micro, color: c.primary },
    flowTo: { ...typography.micro, color: c.textMuted, flex: 1, textAlign: 'right' },
    movementFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.xs + 2,
    },
    movementDate: { ...typography.micro, color: c.textMuted },
    movementNote: { ...typography.micro, color: c.textMuted, flexShrink: 1, textAlign: 'right' },

    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
    },
    pagerButton: {
      paddingHorizontal: spacing.md,
      height: 36,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: 'center',
    },
    pagerDisabled: { opacity: 0.4 },
    pagerText: { ...typography.micro, color: c.text },
    pagerCount: { ...typography.microStrong, ...tabularNums, color: c.textMuted },

    empty: {
      ...typography.caption,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    loader: { marginTop: spacing.lg },

    dialog: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    dialogTitle: { ...typography.bodyStrong, color: c.text },
    dialogText: { ...typography.micro, color: c.textMuted, lineHeight: 18, marginBottom: spacing.xs },
    dialogCancel: { alignItems: 'center', paddingVertical: spacing.sm },
    dialogCancelText: { ...typography.label, color: c.textMuted },
  });
