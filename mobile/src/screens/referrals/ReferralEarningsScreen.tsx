import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { maxWidth, radius, spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../../theme';
import { Card, PageContainer, Pill, PillTone, SegmentedTabs } from '../../components/ui';
import { fetchReferralEarnings, ReferralEarning } from '../../api/referrals';
import { formatDate } from '../../utils/date';

type Filter = 'all' | 'available' | 'pending';

const STATUS_TONE: Record<ReferralEarning['status'], PillTone> = {
  paid: 'success',
  pending: 'warning',
  cancelled: 'danger',
};

export function ReferralEarningsScreen() {
  const styles = useThemeStyles(createStyles);
  const { t, i18n } = useTranslation();
  const [earnings, setEarnings] = useState<ReferralEarning[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      fetchReferralEarnings().then(setEarnings).catch(() => setEarnings([]));
    }, []),
  );

  const shown = useMemo(
    () =>
      earnings.filter((e) =>
        filter === 'all' ? true : filter === 'available' ? e.status === 'paid' : e.status === 'pending',
      ),
    [earnings, filter],
  );

  const title = (e: ReferralEarning) =>
    e.type === 'deposit_percent'
      ? t('referrals.earningPercent', { name: e.sourceName })
      : t('referrals.earningLevel', { name: e.sourceName, level: e.level });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer maxWidth={maxWidth.column}>
        <SegmentedTabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'all', label: t('referrals.filterAll') },
            { key: 'available', label: t('referrals.available') },
            { key: 'pending', label: t('referrals.pending') },
          ]}
        />

        {shown.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyText}>{t('referrals.earningsEmpty')}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {shown.map((e) => (
              <Card key={e.id} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {title(e)}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {e.status === 'pending'
                      ? t('referrals.maturesOn', { date: formatDate(e.maturesAt, i18n.language) })
                      : formatDate(e.createdAt, i18n.language)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowAmount, e.status === 'cancelled' && styles.rowAmountVoid]}>
                    {e.status === 'cancelled' ? '−' : '+'}
                    {e.amount.toLocaleString()} ֏
                  </Text>
                  <Pill label={t(`referrals.status.${e.status}`)} tone={STATUS_TONE[e.status]} />
                </View>
              </Card>
            ))}
          </View>
        )}

        <Text style={styles.note}>{t('referrals.earningsHoldNote')}</Text>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    list: { marginTop: spacing.md, gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rowMain: { flex: 1, minWidth: 0 },
    rowTitle: { ...typography.labelStrong, color: c.text },
    rowSub: { ...typography.micro, color: c.textMuted, marginTop: 2 },
    rowRight: { alignItems: 'flex-end', gap: spacing.xs },
    rowAmount: { ...typography.bodyStrong, ...tabularNums, color: c.success },
    rowAmountVoid: { color: c.danger },

    empty: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.xl },
    emptyText: { ...typography.caption, color: c.textMuted, textAlign: 'center' },

    note: {
      ...typography.micro,
      color: c.textMuted,
      lineHeight: 18,
      marginTop: spacing.lg,
      padding: spacing.md,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
