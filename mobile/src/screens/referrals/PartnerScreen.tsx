import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { maxWidth, radius, spacing, tabularNums, ThemeColors, typography, useTheme, useThemeStyles } from '../../theme';
import { Card, PageContainer, Pill, PillTone, SectionHeader } from '../../components/ui';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { applyForPartner, fetchPartnerStatus, PartnerApplicationStatus, PartnerStatus } from '../../api/partners';
import { useCachedQuery } from '../../api/useCachedQuery';
import { showAlert } from '../../utils/alert';
import { LoadFailed } from '../../components/LoadFailed';
import { TourTarget } from '../../onboarding';

const STATUS_TONE: Record<PartnerApplicationStatus, PillTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'warning',
};

export function PartnerScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [channelType, setChannelType] = useState('Telegram');
  const [channelUrl, setChannelUrl] = useState('');
  const [audienceSize, setAudienceSize] = useState('');
  const [topic, setTopic] = useState('');
  const [plan, setPlan] = useState('');
  const [saving, setSaving] = useState(false);

  // Shares its key with the invites screen, whose blogger card asks the same question.
  const { data: status, error, refresh: load } = useCachedQuery<PartnerStatus>(
    'partners:status',
    fetchPartnerStatus,
  );

  // Failing quietly to null showed the blank application form to someone who might already
  // have one under review — the worst possible reading of "we could not reach the server".
  const loadFailed = !status && !!error;

  const money = (v: number) => `${v.toLocaleString()} ${t('common.currency')}`;
  const terms = status?.terms;

  const canSubmit = channelUrl.trim().length > 4 && plan.trim().length > 20 && topic.trim().length > 2;

  const onApply = async () => {
    setSaving(true);
    try {
      await applyForPartner({
        channelType,
        channelUrl: channelUrl.trim(),
        audienceSize: Number(audienceSize) || 0,
        topic: topic.trim(),
        plan: plan.trim(),
      });
      showAlert(t('partners.sentTitle'), t('partners.sentText'));
      load();
    } catch {
      showAlert(t('common.error'), t('partners.applyFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ── Approved partner: the cabinet ────────────────────────────────────────
  if (status?.isPartner) {
    const e = status.earnings;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PageContainer maxWidth={maxWidth.column}>
          <TourTarget id="partner.card">
          <Card style={styles.balanceCard}>
            <Text style={styles.eyebrow}>{t('partners.owedToCard')}</Text>
            <Text style={styles.balanceValue}>{money(e?.earnedPending ?? 0)}</Text>
            <Text style={styles.hint}>{t('partners.payoutSchedule')}</Text>
            <View style={styles.split}>
              <View style={styles.splitPart}>
                <Text style={[styles.splitValue, { color: colors.success }]}>{money(e?.earnedAvailable ?? 0)}</Text>
                <Text style={styles.splitLabel}>{t('partners.settled')}</Text>
              </View>
              <View style={[styles.splitPart, styles.splitRight]}>
                <Text style={styles.splitValue}>{money(e?.earnedTotal ?? 0)}</Text>
                <Text style={styles.splitLabel}>{t('partners.earnedTotal')}</Text>
              </View>
            </View>
          </Card>
          </TourTarget>

          <SectionHeader title={t('partners.termsTitle')} spaced />
          <Card>
            <Row label={t('partners.perPerson')} value={money(terms?.flat ?? 0)} styles={styles} />
            <Row
              label={t('partners.percentOfDeposit')}
              value={`${((terms?.percent ?? 0) * 100).toFixed(0)}% · ${t('partners.cap', { cap: (terms?.percentCap ?? 0).toLocaleString() })}`}
              styles={styles}
            />
            <Row label={t('partners.depth')} value={t('partners.depthValue')} styles={styles} />
            <Row label={t('partners.paidTo')} value={t('partners.paidToCard')} styles={styles} />
          </Card>

          <Text style={styles.note}>{t('partners.rulesNote')}</Text>
        </PageContainer>
      </ScrollView>
    );
  }

  // ── Application submitted: its state ─────────────────────────────────────
  const app = status?.application;
  if (app && app.status !== 'changes_requested' && app.status !== 'rejected') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PageContainer maxWidth={maxWidth.column}>
          <TourTarget id="partner.card">
            <Card style={styles.balanceCard}>
              <Pill label={t(`partners.status.${app.status}`)} tone={STATUS_TONE[app.status]} />
              <Text style={styles.statusTitle}>{t('partners.underReviewTitle')}</Text>
              <Text style={styles.hint}>{t('partners.underReviewText')}</Text>
            </Card>
          </TourTarget>
          <Text style={styles.note}>{t('partners.whileWaiting')}</Text>
        </PageContainer>
      </ScrollView>
    );
  }

  // ── The offer and the form ───────────────────────────────────────────────
  if (loadFailed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <PageContainer maxWidth={maxWidth.column}>
          <LoadFailed onRetry={load} />
        </PageContainer>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer maxWidth={maxWidth.column}>
        {/* The tour points here in every state this screen has — an offer, an application
            under review, or a partner's cabinet. Only one of the three is ever mounted. */}
        <TourTarget id="partner.card">
          <Card accented style={styles.hero}>
            <Text style={styles.heroTitle}>{t('partners.heroTitle')}</Text>
            <Text style={styles.heroText}>{t('partners.heroText')}</Text>
          </Card>
        </TourTarget>

        <SectionHeader title={t('partners.termsTitle')} spaced />
        <Card>
          <Row label={t('partners.perPerson')} value={money(terms?.flat ?? 500)} styles={styles} />
          <Row
            label={t('partners.percentOfDeposit')}
            value={`${((terms?.percent ?? 0.02) * 100).toFixed(0)}% · ${t('partners.cap', { cap: (terms?.percentCap ?? 10000).toLocaleString() })}`}
            styles={styles}
          />
          <Row label={t('partners.depth')} value={t('partners.depthValue')} styles={styles} />
          <Row label={t('partners.paidTo')} value={t('partners.paidToCard')} styles={styles} />
        </Card>
        <Text style={styles.hint}>{t('partners.whyNoDepth')}</Text>

        {/* What may and may not be said. Put before the form on purpose: it is the
            thing the review actually turns on. */}
        <SectionHeader title={t('partners.rulesTitle')} spaced />
        <Card>
          <Text style={styles.ruleOk}>✓ {t('partners.ruleOk1')}</Text>
          <Text style={styles.ruleOk}>✓ {t('partners.ruleOk2')}</Text>
          <Text style={styles.ruleNo}>✕ {t('partners.ruleNo1')}</Text>
          <Text style={styles.ruleNo}>✕ {t('partners.ruleNo2')}</Text>
          <Text style={styles.ruleNo}>✕ {t('partners.ruleNo3')}</Text>
        </Card>

        {app?.reviewerNote ? (
          <Card style={styles.noteCard}>
            <Text style={styles.eyebrow}>{t(`partners.status.${app.status}`)}</Text>
            <Text style={styles.reviewNote}>{app.reviewerNote}</Text>
          </Card>
        ) : null}

        <SectionHeader title={t('partners.formTitle')} spaced />
        <Card>
          <TextField label={t('partners.channelType')} value={channelType} onChangeText={setChannelType} />
          <TextField
            label={t('partners.channelUrl')}
            value={channelUrl}
            onChangeText={setChannelUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="t.me/mychannel"
          />
          <TextField
            label={t('partners.audienceSize')}
            value={audienceSize}
            onChangeText={setAudienceSize}
            format="integer"
            keyboardType="number-pad"
          />
          <TextField label={t('partners.topic')} value={topic} onChangeText={setTopic} multiline />
          <TextField
            label={t('partners.plan')}
            hint={t('partners.planHint')}
            value={plan}
            onChangeText={setPlan}
            multiline
          />
          <PrimaryButton
            title={t('partners.submit')}
            onPress={onApply}
            loading={saving}
            disabled={!canSubmit}
          />
        </Card>

        <Text style={styles.note}>{t('partners.reviewNote')}</Text>
      </PageContainer>
    </ScrollView>
  );
}

function Row({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, paddingBottom: spacing.xl },

    hero: { backgroundColor: c.primary, borderColor: c.primary },
    heroTitle: { ...typography.title, color: c.textOnAccent },
    heroText: { ...typography.caption, color: c.textOnAccentMuted, marginTop: spacing.sm, lineHeight: 19 },

    balanceCard: { alignItems: 'center' },
    eyebrow: { ...typography.eyebrow, color: c.textMuted },
    balanceValue: { ...typography.display, ...tabularNums, color: c.text, marginTop: spacing.xs },
    statusTitle: { ...typography.heading, color: c.text, marginTop: spacing.md },
    hint: { ...typography.micro, color: c.textMuted, marginTop: spacing.sm, lineHeight: 17, textAlign: 'center' },
    split: {
      flexDirection: 'row',
      alignSelf: 'stretch',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    splitPart: { flex: 1, alignItems: 'center' },
    splitRight: { borderLeftWidth: 1, borderLeftColor: c.border },
    splitValue: { ...typography.subheading, ...tabularNums, color: c.text },
    splitLabel: { ...typography.micro, color: c.textMuted, marginTop: 2 },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    rowLabel: { ...typography.caption, color: c.textMuted, flex: 1 },
    rowValue: { ...typography.captionStrong, ...tabularNums, color: c.text },

    ruleOk: { ...typography.caption, color: c.text, marginBottom: spacing.sm },
    ruleNo: { ...typography.caption, color: c.text, marginBottom: spacing.sm },

    noteCard: { marginTop: spacing.md },
    reviewNote: { ...typography.caption, color: c.text, marginTop: spacing.xs, lineHeight: 19 },

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
