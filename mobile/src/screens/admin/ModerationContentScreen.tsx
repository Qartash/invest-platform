import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  NeglectedProject,
  ReportGroup,
  fetchNeglectedProjects,
  fetchReports,
  resolveReport,
} from '../../api/projectSocial';
import { getLocalizedText } from '../../utils/localized';
import { formatDateTime } from '../../utils/date';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Card, Pill, SectionHeader } from '../../components/ui';
import { radius, spacing, ThemeColors, typography, useThemeStyles } from '../../theme';

/**
 * The moderator's side of the public conversation: what people reported, and
 * which projects are leaving their investors in the dark.
 *
 * The second list is not a rule-breaking queue. Nobody is punished for going
 * quiet — it is the list of founders whose investors are being ignored, which is
 * the thing the whole questions feature exists to make visible, and a moderator
 * seeing it early is worth more than any sanction afterwards.
 */
export function ModerationContentScreen() {
  const { t, i18n } = useTranslation();
  const styles = useThemeStyles(createStyles);

  const [reports, setReports] = useState<ReportGroup[]>([]);
  const [neglected, setNeglected] = useState<NeglectedProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [reportRows, neglectedRows] = await Promise.all([
        fetchReports('pending'),
        fetchNeglectedProjects(),
      ]);
      setReports(reportRows);
      setNeglected(neglectedRows);
    } catch {
      setReports([]);
      setNeglected([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeader title={t('moderation.content.reports')} />
      {loading ? (
        <Text style={styles.muted}>{t('common.loading')}</Text>
      ) : reports.length === 0 ? (
        <Card>
          <Text style={styles.muted}>{t('moderation.content.noReports')}</Text>
        </Card>
      ) : (
        reports.map((group) => (
          <ReportCard
            key={`${group.targetType}:${group.targetId}`}
            group={group}
            onResolved={() => void load()}
          />
        ))
      )}

      <SectionHeader title={t('moderation.content.neglected')} spaced />
      {neglected.length === 0 ? (
        <Card>
          <Text style={styles.muted}>{t('moderation.content.noNeglected')}</Text>
        </Card>
      ) : (
        neglected.map((project) => (
          <Card key={project.projectId} style={styles.neglectedRow}>
            <Text style={styles.projectTitle}>{getLocalizedText(project.title, i18n.language)}</Text>
            <View style={styles.pills}>
              {project.unansweredCount > 0 && (
                <Pill
                  label={t('moderation.content.unanswered', { count: project.unansweredCount })}
                  tone={project.unansweredCount > 3 ? 'danger' : 'warning'}
                />
              )}
              <Pill
                label={
                  project.silentDays === null
                    ? t('moderation.content.neverPosted')
                    : t('moderation.content.silentDays', { count: project.silentDays })
                }
                tone="neutral"
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function ReportCard({ group, onResolved }: { group: ReportGroup; onResolved: () => void }) {
  const { t, i18n } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (status: 'hidden' | 'dismissed') => {
    // Hiding without a reason is refused by the server, and rightly: the author
    // is shown this sentence, and "your question was removed" with no reason is
    // how a moderation queue turns into a grievance queue.
    if (status === 'hidden' && reason.trim().length === 0) {
      showAlert(t('common.error'), t('moderation.content.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await resolveReport(group.targetType, group.targetId, status, reason.trim() || undefined);
      onResolved();
    } catch (err) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.reportCard}>
      <View style={styles.pills}>
        <Pill
          label={t('moderation.content.reportCount', { count: group.reportCount })}
          tone={group.reportCount > 2 ? 'danger' : 'warning'}
        />
        <Pill label={t(`moderation.content.target.${group.targetType}`)} tone="neutral" />
        {group.content?.fromFounder && <Pill label={t('social.founder')} tone="primary" />}
      </View>

      {group.content && (
        <>
          <Text style={styles.projectTitle}>
            {getLocalizedText(group.content.projectTitle ?? undefined, i18n.language)}
          </Text>
          <Text style={styles.body}>{group.content.body}</Text>
          <Text style={styles.meta}>
            {group.content.author?.fullName ?? t('social.deletedUser')} ·{' '}
            {formatDateTime(group.content.createdAt, i18n.language)}
          </Text>
        </>
      )}

      <Text style={styles.meta}>
        {t('moderation.content.reasons')}:{' '}
        {group.reasons.map((code) => t(`moderation.content.reason.${code}`)).join(', ')}
      </Text>
      {group.comments.map((comment, index) => (
        <Text key={index} style={styles.comment}>
          “{comment}”
        </Text>
      ))}

      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t('moderation.content.reasonPlaceholder')}
        style={styles.input}
        maxLength={200}
      />
      <View style={styles.buttons}>
        <PrimaryButton
          title={t('moderation.content.hide')}
          onPress={() => void decide('hidden')}
          disabled={busy}
          size="small"
        />
        <PrimaryButton
          title={t('moderation.content.keep')}
          onPress={() => void decide('dismissed')}
          disabled={busy}
          variant="outline"
          size="small"
        />
      </View>
      <Text style={styles.note}>{t('moderation.content.hideNote')}</Text>
    </Card>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    muted: { ...typography.caption, color: c.textMuted },
    reportCard: { gap: spacing.sm },
    neglectedRow: { gap: spacing.xs },
    pills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    projectTitle: { ...typography.labelStrong, color: c.text },
    body: { ...typography.body, color: c.text },
    meta: { ...typography.micro, color: c.textMuted },
    comment: { ...typography.caption, color: c.textMuted, fontStyle: 'italic' },
    input: {
      ...typography.label,
      color: c.text,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.sm,
    },
    buttons: { flexDirection: 'row', gap: spacing.sm },
    note: { ...typography.micro, color: c.textMuted },
  });
