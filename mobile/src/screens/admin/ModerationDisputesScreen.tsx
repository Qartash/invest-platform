import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchDisputedWorks, resolveDispute } from '../../api/projectWorks';
import { useCachedQuery } from '../../api/useCachedQuery';
import { DisputedWork } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useThemeStyles } from '../../theme';
import { useGrid } from '../../components/ui';

export function ModerationDisputesScreen() {
  const styles = useThemeStyles(createStyles);
  const { t, i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [actingId, setActingId] = useState<string | null>(null);

  // Refetches quietly on focus; resolving a dispute below still forces a reload, since the
  // row that just moved is the whole point of the list.
  const { data: fetched, loading, refresh: load } = useCachedQuery<DisputedWork[]>(
    'works:disputed',
    fetchDisputedWorks,
  );
  const works = useMemo(() => fetched ?? [], [fetched]);
  const { columns, data, isGrid } = useGrid(works, { medium: 2, wide: 2 });

  const resolve = async (id: string, releaseToWorker: boolean) => {
    setActingId(id);
    try {
      await resolveDispute(id, releaseToWorker);
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setActingId(null);
    }
  };

  const currency = t('common.currency');

  return (
    <FlatList
      key={columns}
      numColumns={columns}
      columnWrapperStyle={isGrid ? styles.row : undefined}
      data={data}
      keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
      contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
      renderItem={({ item }) => {
        if (!item) return <View style={styles.cell} />;
        const card = (
        <View style={styles.card}>
          <Text style={styles.project}>{getLocalizedText(item.projectTitle, i18n.language)}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.brief}>{item.brief}</Text>
          <Text style={styles.meta}>
            {item.escrowAmount !== null ? `${item.escrowAmount.toLocaleString()} ${currency}` : '—'}
            {item.assigneeName ? ` · ${item.assigneeName}` : ''}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.pay}
              disabled={actingId === item.id}
              onPress={() => resolve(item.id, true)}
            >
              <Text style={styles.payText}>{t('works.disputePayWorker')}</Text>
            </Pressable>
            <Pressable
              style={styles.refund}
              disabled={actingId === item.id}
              onPress={() => resolve(item.id, false)}
            >
              <Text style={styles.refundText}>{t('works.disputeRefund')}</Text>
            </Pressable>
          </View>
        </View>
        );
        return isGrid ? <View style={styles.cell}>{card}</View> : card;
      }}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('works.noDisputes')}</Text> : null}
    />
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    listWide: { maxWidth: maxWidth.page, width: '100%', alignSelf: 'center' },
    row: { gap: spacing.sm },
    cell: { flex: 1 },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    project: { fontSize: 13, color: c.textMuted },
    title: { fontSize: 15, fontWeight: '700', color: c.text, marginTop: 2 },
    brief: { fontSize: 13, color: c.text, marginTop: 2 },
    meta: { fontSize: 13, fontWeight: '600', color: c.primary, marginTop: spacing.xs },
    actions: { flexDirection: 'row', marginTop: spacing.md },
    pay: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    payText: { color: c.textOnAccent, fontWeight: '700' },
    refund: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    refundText: { color: c.danger, fontWeight: '700' },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: spacing.xl },
  });
