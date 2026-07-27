import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  PartnerApplicationForReview,
  PartnerApplicationStatus,
  PartnerPayoutDue,
  fetchPartnerApplications,
  fetchPartnerPayoutsDue,
  reviewPartnerApplication,
  settlePartnerPayout,
} from '../../api/partners';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/date';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useThemeStyles } from '../../theme';
import { useGrid } from '../../components/ui';

// The applicant's half of this shipped without the moderator's half: an application
// could be filed and then never decided, leaving the applicant on "under review"
// with no exit. Both halves of the decision live here — the queue of applications,
// and the money owed to the partners who came out of it.
//
// Payouts share this tab rather than sitting in the finance section: what is owed
// only exists because of a decision made here, and nothing on the platform moves
// when it is settled — the transfer happens on a card, outside, and this only
// records that someone made it.

type Section = 'applications' | 'payouts';

// Every decision the backend accepts. Approving is the only one that grants partner
// standing; the other two leave the applicant's ordinary referral earnings alone,
// so a refusal costs them nothing they already had.
const DECISIONS: Array<{ status: PartnerApplicationStatus; labelKey: string; tone: 'accept' | 'reject' | 'neutral' }> = [
  { status: 'approved', labelKey: 'partners.admin.approve', tone: 'accept' },
  { status: 'changes_requested', labelKey: 'partners.admin.requestChanges', tone: 'neutral' },
  { status: 'rejected', labelKey: 'partners.admin.reject', tone: 'reject' },
];

export function ModerationPartnersScreen() {
  const styles = useThemeStyles(createStyles);
  const { t, i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [section, setSection] = useState<Section>('applications');
  const [applications, setApplications] = useState<PartnerApplicationForReview[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayoutDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  // Keyed by application: each card keeps its own note, so opening a second card
  // does not inherit what was typed into the first.
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      if (section === 'applications') {
        setApplications(await fetchPartnerApplications('pending'));
      } else {
        setPayouts(await fetchPartnerPayoutsDue());
      }
    } catch {
      // Distinct from an empty queue on purpose: "no applications" and "could not
      // ask" look identical otherwise, and one of them needs a retry.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (application: PartnerApplicationForReview, status: PartnerApplicationStatus) => {
    const note = notes[application.id]?.trim();
    // Anything other than an approval is something the applicant has to act on, and
    // they cannot act on silence.
    if (status !== 'approved' && !note) {
      showAlert(t('partners.admin.noteRequired'));
      return;
    }
    setActingId(application.id);
    try {
      await reviewPartnerApplication(application.id, status, note || undefined);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[application.id];
        return next;
      });
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setActingId(null);
    }
  };

  const settle = async (row: PartnerPayoutDue) => {
    setActingId(row.userId);
    try {
      const { settled } = await settlePartnerPayout(row.earningIds);
      await load();
      showAlert(t('partners.admin.settled', { count: settled }));
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setActingId(null);
    }
  };

  const currency = t('common.currency');
  const listSource = section === 'applications' ? applications : payouts;
  const { columns, data, isGrid } = useGrid(listSource as Array<PartnerApplicationForReview | PartnerPayoutDue>, {
    medium: 2,
    wide: 2,
  });

  const switcher = useMemo(
    () => (
      <View style={styles.switcher}>
        {(['applications', 'payouts'] as Section[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.switchChip, section === key && styles.switchChipActive]}
            onPress={() => setSection(key)}
          >
            <Text style={[styles.switchChipText, section === key && styles.switchChipTextActive]}>
              {t(key === 'applications' ? 'partners.admin.tabApplications' : 'partners.admin.tabPayouts')}
            </Text>
          </Pressable>
        ))}
      </View>
    ),
    [styles, t, section],
  );

  if (loadFailed) {
    return (
      <View style={styles.stateBox}>
        {switcher}
        <Text style={styles.error}>{t('common.loadFailed')}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      key={`${section}-${columns}`}
      numColumns={columns}
      columnWrapperStyle={isGrid ? styles.row : undefined}
      data={data}
      keyExtractor={(item, index) =>
        item ? ('userId' in item ? item.userId : item.id) : `filler-${index}`
      }
      contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
      ListHeaderComponent={switcher}
      renderItem={({ item }) => {
        if (!item) return <View style={styles.cell} />;

        const card =
          'userId' in item ? (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.amount}>
                {item.amount.toLocaleString()} {currency}
              </Text>
              <Text style={styles.meta}>
                {t('partners.admin.earningCount', { count: item.earningIds.length })}
              </Text>
              <Pressable
                style={[styles.accept, actingId === item.userId && styles.buttonBusy]}
                disabled={actingId === item.userId}
                onPress={() => settle(item)}
              >
                <Text style={styles.acceptText}>{t('partners.admin.markPaid')}</Text>
              </Pressable>
              <Text style={styles.hint}>{t('partners.admin.markPaidHint')}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.name}>{item.applicant.name}</Text>
              <Text style={styles.meta}>
                {t('partners.admin.memberSince', { date: formatDate(item.applicant.memberSince, i18n.language) })}
                {' · '}
                {t('partners.admin.appliedOn', { date: formatDate(item.createdAt, i18n.language) })}
              </Text>

              <View style={styles.factRow}>
                <Text style={styles.factLabel}>{t('partners.channelType')}</Text>
                <Text style={styles.factValue}>{item.channelType}</Text>
              </View>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>{t('partners.audienceSize')}</Text>
                <Text style={styles.factValue}>{item.audienceSize.toLocaleString()}</Text>
              </View>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>{t('partners.topic')}</Text>
                <Text style={styles.factValue}>{item.topic}</Text>
              </View>
              {/* The channel is the whole basis of the decision, so it has to be
                  openable rather than a string to copy out by hand. */}
              <Pressable onPress={() => Linking.openURL(item.channelUrl)}>
                <Text style={styles.link}>{item.channelUrl}</Text>
              </Pressable>
              <Text style={styles.plan}>{item.plan}</Text>

              <TextInput
                style={styles.noteInput}
                value={notes[item.id] ?? ''}
                onChangeText={(text) => setNotes((prev) => ({ ...prev, [item.id]: text }))}
                placeholder={t('partners.admin.notePlaceholder')}
                multiline
              />

              <View style={styles.actions}>
                {DECISIONS.map((decision) => (
                  <Pressable
                    key={decision.status}
                    style={[
                      decision.tone === 'accept' && styles.accept,
                      decision.tone === 'reject' && styles.reject,
                      decision.tone === 'neutral' && styles.neutral,
                      actingId === item.id && styles.buttonBusy,
                    ]}
                    disabled={actingId === item.id}
                    onPress={() => decide(item, decision.status)}
                  >
                    <Text
                      style={[
                        decision.tone === 'accept' && styles.acceptText,
                        decision.tone === 'reject' && styles.rejectText,
                        decision.tone === 'neutral' && styles.neutralText,
                      ]}
                    >
                      {t(decision.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );

        return isGrid ? <View style={styles.cell}>{card}</View> : card;
      }}
      ListEmptyComponent={
        !loading ? (
          <Text style={styles.empty}>
            {t(section === 'applications' ? 'partners.admin.noApplications' : 'partners.admin.noPayouts')}
          </Text>
        ) : null
      }
    />
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    listWide: { maxWidth: maxWidth.page, width: '100%', alignSelf: 'center' },
    row: { gap: spacing.sm },
    cell: { flex: 1 },
    switcher: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    switchChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    switchChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    switchChipText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    switchChipTextActive: { color: c.textOnAccent },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    name: { fontSize: 15, fontWeight: '700', color: c.text },
    amount: { fontSize: 20, fontWeight: '700', color: c.primary, marginTop: 2 },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    factRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    factLabel: { fontSize: 13, color: c.textMuted },
    factValue: { fontSize: 13, fontWeight: '600', color: c.text, flexShrink: 1, textAlign: 'right' },
    link: { fontSize: 13, color: c.primary, marginTop: spacing.xs, textDecorationLine: 'underline' },
    plan: { fontSize: 13, color: c.text, marginTop: spacing.xs },
    noteInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: spacing.sm,
      marginTop: spacing.md,
      minHeight: 64,
      color: c.text,
      textAlignVertical: 'top',
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    accept: {
      flexGrow: 1,
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    acceptText: { color: c.textOnAccent, fontWeight: '700' },
    reject: {
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    rejectText: { color: c.danger, fontWeight: '700' },
    neutral: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    neutralText: { color: c.text, fontWeight: '700' },
    buttonBusy: { opacity: 0.5 },
    hint: { fontSize: 11, color: c.textMuted, marginTop: spacing.xs },
    stateBox: { padding: spacing.lg, maxWidth: maxWidth.page, width: '100%', alignSelf: 'center' },
    error: { color: c.danger, marginTop: spacing.md },
    retry: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 10,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    retryText: { color: c.primary, fontWeight: '700' },
    empty: { textAlign: 'center', color: c.textMuted, marginTop: spacing.xl },
  });
