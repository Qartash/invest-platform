import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { decideRelease, fetchPendingReleases } from '../../api/projectFunding';
import { PendingReleaseRequest } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { showAlert } from '../../utils/alert';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../../theme';

export function ModerationReleasesScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
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
    project: { fontSize: 15, fontWeight: '700', color: c.text },
    stage: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
    amount: { fontSize: 16, fontWeight: '700', color: c.primary },
    treasury: { fontSize: 12 },
    note: { fontSize: 12, color: c.text, marginTop: spacing.xs, fontStyle: 'italic' },
    actions: { flexDirection: 'row', marginTop: spacing.md },
    approve: {
      flex: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    disabled: { opacity: 0.4 },
    approveText: { color: c.textOnAccent, fontWeight: '700' },
    reject: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    rejectText: { color: c.danger, fontWeight: '700' },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: spacing.xl },
  });
