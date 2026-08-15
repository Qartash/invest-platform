import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  fetchProject,
  fetchProjectAttachments,
  approveProject,
  rejectProject,
  setProjectRisk,
  setProjectPriority,
  approveProjectDeletion,
  rejectProjectDeletion,
} from '../../api/projects';
import { refundProject } from '../../api/projectFunding';
import { invalidateQuery, useCachedQuery } from '../../api/useCachedQuery';
import { resolveMediaUrl } from '../../api/client';
import { Project, ProjectAttachment } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { formatDate } from '../../utils/date';
import {
  DIFF_FIELD_LABEL_KEYS,
  LOCALIZED_DIFF_FIELDS,
  STAKE_DIFF_FIELDS,
  formatDiffValue,
  formatLocalizedDiffText,
  getChangedLanguages,
} from '../../utils/projectDiff';
import { RichTextView } from '../../components/RichTextView';
import { RichTextEditor } from '../../components/RichTextEditor';
import { isRichTextEmpty } from '../../utils/richText';
import { PRIORITY_LEVELS, priorityColors } from '../../utils/priority';
import { LANGUAGE_LABELS } from '../../i18n';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useTheme, useThemeStyles } from '../../theme';
import { Icon } from '../../components/ui';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TicketPriceChart } from '../../components/TicketPriceChart';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { InvestorProfileModal } from '../../components/InvestorProfileModal';
import { ProjectHistoryModal } from '../../components/ProjectHistoryModal';
import { ModerationStackParamList } from '../../navigation/ModerationNavigator';

type Props = NativeStackScreenProps<ModerationStackParamList, 'ModerationDetail'>;

const RISK_LEVELS: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModerationDetailScreen({ route, navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const PRIORITY_COLORS = useMemo(() => priorityColors(colors), [colors]);
  const { projectId } = route.params;
  const { t, i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | null>(null);
  const [riskComment, setRiskComment] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showFounderProfile, setShowFounderProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [priorityUpdating, setPriorityUpdating] = useState(false);

  // Both keys are the ones the investor's project screen uses, so a moderator who has just
  // looked at the project sees it here without a second round of requests. Every decision
  // below retires the whole `projects:` prefix, so nothing here outlives the decision.
  const { data: project, refresh: refreshProject } = useCachedQuery<Project>(
    `projects:one:${projectId}`,
    useCallback(() => fetchProject(projectId), [projectId]),
  );
  const { data: fetchedAttachments, refresh: refreshAttachments } = useCachedQuery<ProjectAttachment[]>(
    `projects:one:${projectId}:attachments`,
    useCallback(() => fetchProjectAttachments(projectId), [projectId]),
  );

  const attachments = fetchedAttachments ?? [];

  const load = useCallback(() => {
    invalidateQuery('projects');
    void refreshProject();
    void refreshAttachments();
  }, [refreshProject, refreshAttachments]);

  // Pre-fill with the risk assessment already on file so a re-review of a minor edit doesn't
  // force the moderator to redo it from scratch (and risk picking a different level than
  // before by mistake). Only ever fills a blank field — never types over the moderator.
  useEffect(() => {
    if (!project) return;
    setRiskLevel((prev) => prev ?? (project.riskLevel ?? null));
    setRiskComment((prev) => prev || (project.riskReason ?? ''));
  }, [project]);

  const handleSetPriority = async (priority: 'low' | 'medium' | 'high') => {
    if (!project || priority === project.priority) return;
    setPriorityUpdating(true);
    try {
      await setProjectPriority(project.id, priority);
      // The priority shows on the queue behind this screen and on the project cards, so it
      // is reloaded from the server rather than patched in here.
      load();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setPriorityUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!project || !riskLevel || isRichTextEmpty(riskComment) || isRichTextEmpty(generalComment)) return;
    setSubmitting(true);
    try {
      await setProjectRisk(project.id, riskLevel, riskComment.trim());
      await approveProject(project.id, generalComment.trim());
      navigation.goBack();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!project || isRichTextEmpty(generalComment)) return;
    setSubmitting(true);
    try {
      await rejectProject(project.id, generalComment.trim());
      navigation.goBack();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveDeletion = async () => {
    if (!project) return;
    setSubmitting(true);
    try {
      await approveProjectDeletion(project.id);
      navigation.goBack();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectDeletion = async () => {
    if (!project || isRichTextEmpty(generalComment)) return;
    setSubmitting(true);
    try {
      await rejectProjectDeletion(project.id, generalComment.trim());
      navigation.goBack();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  if (!project) return null;

  // Which of the three preconditions for approval are still unmet, in the order the
  // form asks for them.
  const missingToApprove = [
    !riskLevel && 'project.riskLevelLabel',
    isRichTextEmpty(riskComment) && 'project.riskReasonLabel',
    isRichTextEmpty(generalComment) && 'founder.reviewCommentLabel',
  ].filter(Boolean) as string[];

  const isDeletionRequest = !!project.deletionRequestedAt;
  const { pricing } = project;
  const collected = parseFloat(project.collectedAmount);
  const target = parseFloat(project.targetAmount);
  const fundingProgress = target > 0 ? Math.min(collected / target, 1) : 0;
  const chartPoints = pricing.tiers.map((tier) => ({ unitPrice: tier.price }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}>
      {project.coverImageUrl ? (
        <Image source={{ uri: resolveMediaUrl(project.coverImageUrl) }} style={styles.cover} />
      ) : null}
      <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>
      {project.founderName && (
        <Pressable onPress={() => setShowFounderProfile(true)}>
          <Text style={[styles.founder, styles.founderLink]}>
            {t('project.by')} {project.founderName}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.historyLink} onPress={() => setShowHistory(true)}>
        <Text style={styles.historyLinkText}>{t('founder.historyTitle')}</Text>
      </Pressable>

      {!project.deletedAt && (
        <Pressable
          style={styles.historyLink}
          onPress={() => navigation.navigate('ModerationEdit', { projectId: project.id, adminEdit: true })}
        >
          <Text style={styles.historyLinkText}>✏️ {t('founder.editProject')}</Text>
        </Pressable>
      )}

      {!project.deletedAt && parseFloat(project.treasuryBalance ?? '0') > 0 && (
        <Pressable
          style={styles.historyLink}
          onPress={() =>
            showAlert(t('moderation.refund.confirmTitle'), t('moderation.refund.confirmMessage'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('moderation.refund.action'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    const res = await refundProject(project.id);
                    showAlert(t('moderation.refund.done', { amount: res.refundedTotal.toLocaleString(), count: res.holders }));
                    navigation.goBack();
                  } catch (err: any) {
                    showAlert(t('common.error'), apiErrorMessage(err, t));
                  }
                },
              },
            ])
          }
        >
          <Text style={[styles.historyLinkText, { color: colors.danger }]}>↩ {t('moderation.refund.action')}</Text>
        </Pressable>
      )}

      <Text style={styles.section}>{t('project.priorityLevelLabel')}</Text>
      <View style={styles.levelRow}>
        {PRIORITY_LEVELS.map((lvl) => (
          <Pressable
            key={lvl}
            style={[
              styles.priorityChip,
              { borderColor: PRIORITY_COLORS[lvl] },
              project.priority === lvl && { backgroundColor: PRIORITY_COLORS[lvl] },
            ]}
            onPress={() => handleSetPriority(lvl)}
            disabled={priorityUpdating}
          >
            <Text style={[styles.priorityChipText, project.priority === lvl && styles.priorityChipTextActive]}>
              {t(`project.priority.${lvl}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isDeletionRequest ? (
        <View style={styles.deletionBox}>
          <Text style={styles.deletionTitle}>{t('founder.deletionRequestTitle')}</Text>
          <Text style={styles.description}>
            {t('founder.deletionRequestMessage', {
              investors: project.investorCount ?? 0,
              tickets: project.ticketsSold,
            })}
          </Text>

          <Text style={[styles.section, styles.sectionSpacing]}>{t('founder.reviewCommentLabel')}</Text>
          <RichTextEditor
            value={generalComment}
            onChangeText={setGeneralComment}
            placeholder={t('founder.reviewCommentPlaceholder')}
          />

          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <PrimaryButton title={t('founder.approveDeletion')} onPress={handleApproveDeletion} loading={submitting} />
            </View>
            <View style={{ width: spacing.sm }} />
            <View style={styles.actionButton}>
              <PrimaryButton
                title={t('founder.rejectDeletion')}
                variant="outline"
                onPress={handleRejectDeletion}
                loading={submitting}
                disabled={isRichTextEmpty(generalComment)}
              />
            </View>
          </View>
        </View>
      ) : (
        <>
          {project.pendingChanges && (
        <View style={styles.diffBox}>
          <Text style={styles.diffTitle}>{t('founder.pendingChangesTitle')}</Text>
          {/* "Ticket count 100 → 50" reads like any other row, but it halves what
              every existing holder was sold. The sold count and the money already
              collected go above the diff so they are read before the decision, not
              looked up after it. */}
          {project.ticketsSold > 0 &&
            Object.keys(project.pendingChanges).some((field) => STAKE_DIFF_FIELDS.includes(field)) && (
              <View style={styles.stakeWarnBox}>
                <Text style={styles.stakeWarnTitle}>{t('moderation.stakeChangeWarning')}</Text>
                <Text style={styles.stakeWarnText}>
                  {t('moderation.stakeChangeFacts', {
                    sold: project.ticketsSold,
                    total: project.totalTickets,
                    collected: parseFloat(project.collectedAmount).toLocaleString(),
                    currency: t('common.currency'),
                  })}
                </Text>
              </View>
            )}
          {project.pendingChangeReason && (
            <View style={styles.founderNoteBox}>
              <Text style={styles.founderNoteLabel}>{t('founder.pendingChangeReasonLabel')}</Text>
              <RichTextView
                html={project.pendingChangeReason}
                textStyle={styles.founderNoteText}
                color={colors.text}
                fontSize={13}
              />
            </View>
          )}
          {Object.entries(project.pendingChanges).map(([field, newValue]) => {
            if (LOCALIZED_DIFF_FIELDS.includes(field)) {
              const oldValue = (project as any)[field];
              const changedLangs = getChangedLanguages(oldValue, newValue);
              if (changedLangs.length === 0) return null;
              return (
                <View key={field} style={styles.diffRow}>
                  <Text style={styles.diffLabel}>
                    {t(DIFF_FIELD_LABEL_KEYS[field] ?? field)}
                    {'  '}
                    <Text style={styles.diffLangSummary}>
                      ({changedLangs.map((lang) => LANGUAGE_LABELS[lang]).join(', ')})
                    </Text>
                  </Text>
                  {changedLangs.map((lang) =>
                    field === 'description' ? (
                      <View key={lang} style={styles.diffValues}>
                        <Text style={styles.diffLangTag}>{lang.toUpperCase()}</Text>
                        <View style={styles.diffValuesTextColumn}>
                          <Text style={styles.diffOld}>
                            {formatLocalizedDiffText(field, oldValue?.[lang])}
                          </Text>
                          <Text style={styles.diffArrowVertical}>↓</Text>
                          <Text style={styles.diffNew}>
                            {formatLocalizedDiffText(field, newValue?.[lang])}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View key={lang} style={styles.diffValues}>
                        <Text style={styles.diffLangTag}>{lang.toUpperCase()}</Text>
                        <View style={styles.diffValuesText}>
                          <Text style={styles.diffOld} numberOfLines={2}>
                            {formatLocalizedDiffText(field, oldValue?.[lang])}
                          </Text>
                          <Text style={styles.diffArrow}>→</Text>
                          <Text style={styles.diffNew} numberOfLines={2}>
                            {formatLocalizedDiffText(field, newValue?.[lang])}
                          </Text>
                        </View>
                      </View>
                    ),
                  )}
                </View>
              );
            }
            return (
              <View key={field} style={styles.diffRow}>
                <Text style={styles.diffLabel}>
                  {t(DIFF_FIELD_LABEL_KEYS[field] ?? field)}
                </Text>
                <View style={styles.diffValues}>
                  <Text style={styles.diffOld} numberOfLines={2}>
                    {formatDiffValue(field, (project as any)[field], t, i18n.language)}
                  </Text>
                  <Text style={styles.diffArrow}>→</Text>
                  <Text style={styles.diffNew} numberOfLines={2}>
                    {formatDiffValue(field, newValue, t, i18n.language)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>{t('project.about')}</Text>
      <RichTextView html={getLocalizedText(project.description, i18n.language)} textStyle={styles.description} />

      {attachments.length > 0 && (
        <View style={styles.attachmentsBox}>
          <Text style={styles.attachmentsTitle}>{t('project.attachmentsTitle')}</Text>
          {attachments.map((file) => (
            <Pressable
              key={file.id}
              style={styles.attachmentRow}
              onPress={() => {
                const url = resolveMediaUrl(file.fileUrl);
                if (url) Linking.openURL(url);
              }}
            >
              <Icon name="file" color={colors.textMuted} size={15} />
              <Text style={styles.attachmentName} numberOfLines={1}>
                {file.fileName}
              </Text>
              <Text style={styles.attachmentMeta}>{formatFileSize(file.fileSize)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fundingProgress * 100}%` }]} />
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.meta}>
          {t('home.raised')}: {collected.toLocaleString()} {t('common.currency')}
        </Text>
        <Text style={styles.meta}>
          {t('home.goal')}: {target.toLocaleString()} {t('common.currency')}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('project.ticketPrice')}</Text>
          <Text style={styles.statValue}>
            {parseFloat(project.ticketPrice).toLocaleString()} {t('common.currency')}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>{t('founder.totalTickets')}</Text>
          <Text style={styles.statValue}>{project.totalTickets}</Text>
        </View>
        {project.deadline && (
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('founder.deadline')}</Text>
            <Text style={styles.statValue}>{formatDate(project.deadline, i18n.language)}</Text>
          </View>
        )}
      </View>
      {project.category && <Text style={styles.meta}>{project.category}</Text>}

      <Text style={styles.resaleNote}>
        {project.resaleEnabled ? t('project.resaleAllowed') : t('project.resaleNotAllowed')}
      </Text>

      <Text style={styles.section}>{t('project.priceChart')}</Text>
      <TicketPriceChart points={chartPoints} isProjected />

      <View style={styles.tierList}>
        {pricing.tiers.map((tier) => (
          <View key={tier.tier} style={styles.tierRow}>
            <Text style={styles.tierText}>
              {t('project.roundLabel', { round: tier.tier + 1 })} ({tier.ticketsFrom}–{tier.ticketsTo}):{' '}
              {tier.price.toLocaleString()} {t('common.currency')}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.section, styles.sectionSpacing]}>{t('project.riskLevelLabel')}</Text>
      <View style={styles.levelRow}>
        {RISK_LEVELS.map((lvl) => (
          <Pressable
            key={lvl}
            style={[styles.levelChip, riskLevel === lvl && styles.levelChipActive]}
            onPress={() => setRiskLevel(lvl)}
          >
            <Text style={[styles.levelChipText, riskLevel === lvl && styles.levelChipTextActive]}>
              {t(`project.risk.${lvl}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.section}>{t('project.riskReasonLabel')}</Text>
      <RichTextEditor
        value={riskComment}
        onChangeText={setRiskComment}
        placeholder={t('project.riskReasonPlaceholder')}
      />

      <Text style={[styles.section, styles.sectionSpacing]}>{t('founder.reviewCommentLabel')}</Text>
      <RichTextEditor
        value={generalComment}
        onChangeText={setGeneralComment}
        placeholder={t('founder.reviewCommentPlaceholder')}
      />

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <PrimaryButton
            title={t('founder.approve')}
            onPress={handleApprove}
            loading={submitting}
            disabled={missingToApprove.length > 0}
          />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={styles.actionButton}>
          <PrimaryButton
            title={t('founder.reject')}
            variant="outline"
            onPress={handleReject}
            loading={submitting}
            disabled={isRichTextEmpty(generalComment)}
          />
        </View>
      </View>
      {/* Three separate conditions gate approval, and a dead button named none of
          them. Naming what is still missing is the difference between "this is
          broken" and "I have one field left". */}
      {missingToApprove.length > 0 && (
        <Text style={styles.blockedHint}>
          {t('founder.approveBlocked', { fields: missingToApprove.map((key) => t(key)).join(', ') })}
        </Text>
      )}
        </>
      )}

      <InvestorProfileModal
        visible={showFounderProfile}
        investorId={project.founderId}
        onClose={() => setShowFounderProfile(false)}
      />
      <ProjectHistoryModal visible={showHistory} projectId={project.id} onClose={() => setShowHistory(false)} />
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      padding: spacing.lg,
    },
    // A review page: the moderator reads a description and a diff top to bottom, and prose
    // is what suffers first from a full-window measure.
    contentWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },
    diffBox: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    diffTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: c.primary,
      marginBottom: spacing.sm,
    },
    blockedHint: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    stakeWarnBox: {
      backgroundColor: c.dangerSoft,
      borderLeftWidth: 3,
      borderLeftColor: c.danger,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    stakeWarnTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.danger,
      marginBottom: 2,
    },
    stakeWarnText: {
      fontSize: 13,
      color: c.text,
    },
    founderNoteBox: {
      backgroundColor: c.background,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    founderNoteLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: 2,
    },
    founderNoteText: {
      fontSize: 13,
      color: c.text,
      fontStyle: 'italic',
    },
    diffRow: {
      marginBottom: spacing.sm,
    },
    diffLabel: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 2,
    },
    diffLangSummary: {
      fontSize: 11,
      fontWeight: '600',
      color: c.primary,
    },
    diffValues: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    diffValuesText: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    diffValuesTextColumn: {
      flex: 1,
    },
    diffArrowVertical: {
      fontSize: 13,
      color: c.textMuted,
      marginVertical: spacing.xs,
    },
    diffLangTag: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
      marginRight: spacing.xs,
    },
    diffOld: {
      flex: 1,
      fontSize: 13,
      color: c.danger,
      textDecorationLine: 'line-through',
    },
    diffArrow: {
      fontSize: 13,
      color: c.textMuted,
      marginHorizontal: spacing.xs,
    },
    diffNew: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: c.success,
    },
    deletionBox: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 12,
      padding: spacing.md,
    },
    deletionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.danger,
      marginBottom: spacing.sm,
    },
    cover: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      marginBottom: spacing.md,
      backgroundColor: c.border,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: c.text,
      marginBottom: 2,
    },
    founder: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: spacing.md,
    },
    founderLink: {
      color: c.primary,
      textDecorationLine: 'underline',
    },
    historyLink: {
      alignSelf: 'flex-start',
      marginBottom: spacing.md,
    },
    historyLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.primary,
      textDecorationLine: 'underline',
    },
    section: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    sectionSpacing: {
      marginTop: spacing.lg,
    },
    description: {
      fontSize: 15,
      color: c.text,
      marginBottom: spacing.lg,
    },
    attachmentsBox: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    attachmentsTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    attachmentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.xs + 2,
      paddingVertical: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    attachmentName: {
      flex: 1,
      fontSize: 13,
      color: c.primary,
      fontWeight: '600',
      marginRight: spacing.sm,
    },
    attachmentMeta: {
      fontSize: 11,
      color: c.textMuted,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.border,
      overflow: 'hidden',
      marginBottom: spacing.xs,
    },
    progressFill: {
      height: '100%',
      backgroundColor: c.primary,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    stat: {
      flex: 1,
    },
    statLabel: {
      fontSize: 12,
      color: c.textMuted,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    meta: {
      fontSize: 13,
      color: c.textMuted,
    },
    resaleNote: {
      fontSize: 12,
      color: c.textMuted,
      marginVertical: spacing.md,
    },
    tierList: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    tierRow: {
      paddingVertical: spacing.xs,
    },
    tierText: {
      fontSize: 13,
      color: c.textMuted,
    },
    levelRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    levelChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingVertical: spacing.sm,
      marginRight: spacing.xs,
      alignItems: 'center',
    },
    levelChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    levelChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
    },
    levelChipTextActive: {
      color: c.textOnAccent,
    },
    priorityChip: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: 8,
      paddingVertical: spacing.sm,
      marginRight: spacing.xs,
      alignItems: 'center',
    },
    priorityChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.text,
    },
    priorityChipTextActive: {
      color: c.textOnAccent,
    },
    actions: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    actionButton: {
      flex: 1,
    },
  });
