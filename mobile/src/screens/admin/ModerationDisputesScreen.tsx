import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { fetchDisputedWorks, resolveDispute } from '../../api/projectWorks';
import { DisputedWork } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { showAlert } from '../../utils/alert';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';

export function ModerationDisputesScreen() {
  const styles = useThemeStyles(createStyles);
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
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
