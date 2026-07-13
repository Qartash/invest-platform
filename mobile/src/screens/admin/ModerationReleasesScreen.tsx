import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { decideRelease, fetchPendingReleases } from '../../api/projectFunding';
import { PendingReleaseRequest } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { showAlert } from '../../utils/alert';
import { colors, spacing } from '../../theme';

export function ModerationReleasesScreen() {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState<PendingReleaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await fetchPendingReleases());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (id: string, approve: boolean) => {
    setActingId(id);
    try {
      await decideRelease(id, approve);
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
      data={requests}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const enough = item.treasuryBalance >= item.amount;
        return (
          <View style={styles.card}>
            <Text style={styles.project}>{getLocalizedText(item.projectTitle, i18n.language)}</Text>
            <Text style={styles.stage}>{item.stageTitle}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amount}>
                {item.amount.toLocaleString()} {currency}
              </Text>
              <Text style={[styles.treasury, { color: enough ? colors.textMuted : colors.danger }]}>
                {t('moderation.releases.treasury')}: {item.treasuryBalance.toLocaleString()} {currency}
              </Text>
            </View>
            {!!item.note && <Text style={styles.note}>{item.note}</Text>}
            <View style={styles.actions}>
              <Pressable
                style={[styles.approve, !enough && styles.disabled]}
                disabled={!enough || actingId === item.id}
                onPress={() => decide(item.id, true)}
              >
                <Text style={styles.approveText}>{t('moderation.releases.approve')}</Text>
              </Pressable>
              <Pressable style={styles.reject} disabled={actingId === item.id} onPress={() => decide(item.id, false)}>
                <Text style={styles.rejectText}>{t('moderation.releases.reject')}</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('moderation.releases.none')}</Text> : null}
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
  project: { fontSize: 15, fontWeight: '700', color: colors.text },
  stage: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  amount: { fontSize: 16, fontWeight: '700', color: colors.primary },
  treasury: { fontSize: 12 },
  note: { fontSize: 12, color: colors.text, marginTop: spacing.xs, fontStyle: 'italic' },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  approve: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  disabled: { opacity: 0.4 },
  approveText: { color: '#fff', fontWeight: '700' },
  reject: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  rejectText: { color: colors.danger, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
