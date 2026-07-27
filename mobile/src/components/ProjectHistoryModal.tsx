import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchProjectHistory } from '../api/projects';
import { ProjectReviewLogEntry } from '../types';
import { formatDateTime } from '../utils/date';
import { DIFF_FIELD_LABEL_KEYS } from '../utils/projectDiff';
import { priorityColors, ProjectPriority } from '../utils/priority';
import { maxWidth, radius, spacing, ThemeColors, typography, useBreakpoint, useTheme, useThemeStyles } from '../theme';
import { Dialog, Icon, IconName } from './ui';
import { RichTextView } from './RichTextView';
import { apiErrorMessage } from '../utils/apiError';

// Built per palette rather than at module load, so the action colours follow the theme.
// Icons are drawn glyphs, not emoji: a log read top-to-bottom needs marks of one weight and
// one colour system, and the emoji set rendered at a dozen different sizes and hues.
const actionStyles = (
  c: ThemeColors,
): Record<string, { icon: IconName; labelKey: string; color: string; soft: string }> => ({
  submitted: { icon: 'file', labelKey: 'founder.historySubmitted', color: c.primary, soft: c.primarySoft },
  approved: { icon: 'check', labelKey: 'founder.historyApproved', color: c.success, soft: c.successSoft },
  rejected: { icon: 'close', labelKey: 'founder.historyRejected', color: c.danger, soft: c.dangerSoft },
  cancelled: { icon: 'undo', labelKey: 'founder.historyCancelled', color: c.textMuted, soft: c.surfaceSunken },
  deletion_requested: {
    icon: 'trash',
    labelKey: 'founder.historyDeletionRequested',
    color: c.danger,
    soft: c.dangerSoft,
  },
  deletion_approved: {
    icon: 'trash',
    labelKey: 'founder.historyDeletionApproved',
    color: c.danger,
    soft: c.dangerSoft,
  },
  deletion_rejected: {
    icon: 'shield',
    labelKey: 'founder.historyDeletionRejected',
    color: c.success,
    soft: c.successSoft,
  },
  deleted: { icon: 'trash', labelKey: 'founder.historyDeleted', color: c.danger, soft: c.dangerSoft },
  restored: { icon: 'refresh', labelKey: 'founder.historyRestored', color: c.success, soft: c.successSoft },
  priority_changed: {
    icon: 'flag',
    labelKey: 'founder.historyPriorityChanged',
    color: c.textMuted,
    soft: c.surfaceSunken,
  },
  admin_edited: { icon: 'wrench', labelKey: 'founder.historyAdminEdited', color: c.warning, soft: c.warningSoft },
});

interface Props {
  visible: boolean;
  projectId: string;
  onClose: () => void;
}

export function ProjectHistoryModal({ visible, projectId, onClose }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const PRIORITY_COLORS = useMemo(() => priorityColors(colors), [colors]);
  const ACTION_STYLES = useMemo(() => actionStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [entries, setEntries] = useState<ProjectReviewLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProjectHistory(projectId)
      .then(setEntries)
      .catch((err: any) => {
        setError(apiErrorMessage(err, t));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  return (
    <Dialog visible={visible} onClose={onClose} sheet maxWidth={maxWidth.dialogMd}>
      <View style={[styles.card, !isCompact && styles.cardWide]}>
          {isCompact && <View style={styles.grabber} />}
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('founder.historyTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && styles.pressed}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : entries.length === 0 ? (
            <Text style={styles.empty}>{t('founder.historyEmpty')}</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {entries.map((entry, index) => {
                const meta = ACTION_STYLES[entry.action] ?? ACTION_STYLES.submitted;
                const isPriorityChange = entry.action === 'priority_changed';
                const changedFields = entry.changes && !isPriorityChange ? Object.keys(entry.changes) : [];
                const last = index === entries.length - 1;

                return (
                  <View key={entry.id} style={styles.entry}>
                    {/* Rail and plaque: the marks stack into one vertical line down the log. */}
                    <View style={styles.rail}>
                      <View style={[styles.plaque, { backgroundColor: meta.soft }]}>
                        <Icon name={meta.icon} size={15} color={meta.color} />
                      </View>
                      {!last && <View style={styles.railLine} />}
                    </View>

                    <View style={styles.entryBody}>
                      <View style={styles.entryHeader}>
                        <Text style={[styles.entryAction, { color: meta.color }]} numberOfLines={1}>
                          {t(meta.labelKey)}
                        </Text>
                        <Text style={styles.entryDate}>{formatDateTime(entry.createdAt, i18n.language)}</Text>
                      </View>

                      {entry.moderatorName && (
                        <Text style={styles.entryNote}>
                          {t('project.by')} {entry.moderatorName}
                        </Text>
                      )}

                      {index === 0 && entry.action === 'submitted' && !entry.changes && (
                        <Text style={styles.entryNote}>{t('founder.historyFirstSubmission')}</Text>
                      )}

                      {isPriorityChange && entry.changes && (
                        <View style={styles.priorityRow}>
                          <View
                            style={[
                              styles.priorityDot,
                              { backgroundColor: PRIORITY_COLORS[entry.changes.from as ProjectPriority] },
                            ]}
                          />
                          <Text style={styles.entryNote}>{t(`project.priority.${entry.changes.from}`)}</Text>
                          <Text style={styles.entryNote}>→</Text>
                          <View
                            style={[
                              styles.priorityDot,
                              { backgroundColor: PRIORITY_COLORS[entry.changes.to as ProjectPriority] },
                            ]}
                          />
                          <Text style={styles.entryNote}>{t(`project.priority.${entry.changes.to}`)}</Text>
                        </View>
                      )}

                      {changedFields.length > 0 && (
                        <Text style={styles.entryNote}>
                          {t('founder.historyChangedFields')}:{' '}
                          {changedFields.map((f) => t(DIFF_FIELD_LABEL_KEYS[f] ?? f)).join(', ')}
                        </Text>
                      )}

                      {entry.comment && (
                        <View style={styles.commentBox}>
                          <RichTextView
                            html={entry.comment}
                            textStyle={styles.comment}
                            color={colors.text}
                            fontSize={13}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
      </View>
    </Dialog>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      maxHeight: '82%',
    },
    // Centred on a desktop window: rounded all round, and free to use more of the height
    // than the phone sheet's 82% since it isn't anchored to the bottom edge.
    cardWide: {
      borderRadius: radius.xl,
      paddingTop: spacing.md,
      maxHeight: '90%',
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      marginBottom: spacing.sm,
    },
    pressed: {
      opacity: 0.6,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading,
      color: c.text,
    },
    loader: {
      marginVertical: spacing.xl,
    },
    empty: {
      ...typography.body,
      textAlign: 'center',
      color: c.textMuted,
      marginVertical: spacing.xl,
    },
    errorText: {
      ...typography.body,
      textAlign: 'center',
      color: c.danger,
      marginVertical: spacing.xl,
    },

    entry: {
      flexDirection: 'row',
      gap: spacing.sm + 2,
    },
    rail: {
      alignItems: 'center',
      width: 28,
    },
    plaque: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    railLine: {
      flex: 1,
      width: 1,
      backgroundColor: c.border,
      marginVertical: spacing.xs,
    },
    entryBody: {
      flex: 1,
      paddingBottom: spacing.md + 2,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    entryAction: {
      ...typography.labelStrong,
      flex: 1,
    },
    entryDate: {
      ...typography.micro,
      color: c.textMuted,
    },
    entryNote: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: 3,
    },
    priorityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 3,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    commentBox: {
      marginTop: spacing.sm,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    comment: {
      ...typography.caption,
      color: c.text,
    },
  });
