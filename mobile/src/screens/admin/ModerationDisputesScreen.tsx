import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { fetchDisputedWorks, resolveDispute } from '../../api/projectWorks';
import { DisputedWork } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { showAlert } from '../../utils/alert';
import { colors, spacing } from '../../theme';

export function ModerationDisputesScreen() {
  const { t, i18n } = useTranslation();
  const [works, setWorks] = useState<DisputedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorks(await fetchDisputedWorks());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resolve = async (id: string, releaseToWorker: boolean) => {
    setActingId(id);
    try {
      await resolveDispute(id, releaseToWorker);
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setActingId(null);
    }
  };

  const currency = t('common.currency');

  return (
    <FlatList
      data={works}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
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
      )}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('works.noDisputes')}</Text> : null}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  project: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  brief: { fontSize: 13, color: colors.text, marginTop: 2 },
  meta: { fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: spacing.xs },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  pay: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  payText: { color: '#fff', fontWeight: '700' },
  refund: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  refundText: { color: colors.danger, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
