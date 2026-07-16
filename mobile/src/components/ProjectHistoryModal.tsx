import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchProjectHistory } from '../api/projects';
import { ProjectReviewLogEntry } from '../types';
import { formatDateTime } from '../utils/date';
import { DIFF_FIELD_LABEL_KEYS } from '../utils/projectDiff';
import { priorityColors, ProjectPriority } from '../utils/priority';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { RichTextView } from './RichTextView';

interface Props {
  visible: boolean;
  projectId: string;
  onClose: () => void;
}

// Built per palette rather than at module load, so the action colours follow the theme.
const actionStyles = (c: ThemeColors): Record<string, { icon: string; labelKey: string; color: string }> => ({
  submitted: { icon: '📝', labelKey: 'founder.historySubmitted', color: c.primary },
  approved: { icon: '✅', labelKey: 'founder.historyApproved', color: c.success },
  rejected: { icon: '❌', labelKey: 'founder.historyRejected', color: c.danger },
  cancelled: { icon: '↩️', labelKey: 'founder.historyCancelled', color: c.textMuted },
  deletion_requested: { icon: '🗑', labelKey: 'founder.historyDeletionRequested', color: c.danger },
  deletion_approved: { icon: '🗑', labelKey: 'founder.historyDeletionApproved', color: c.danger },
  deletion_rejected: { icon: '🛡', labelKey: 'founder.historyDeletionRejected', color: c.success },
  deleted: { icon: '🗑', labelKey: 'founder.historyDeleted', color: c.danger },
  restored: { icon: '♻️', labelKey: 'founder.historyRestored', color: c.success },
  priority_changed: { icon: '🚩', labelKey: 'founder.historyPriorityChanged', color: c.textMuted },
  admin_edited: { icon: '🛠', labelKey: 'founder.historyAdminEdited', color: c.warning },
});

export function ProjectHistoryModal({ visible, projectId, onClose }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const PRIORITY_COLORS = useMemo(() => priorityColors(colors), [colors]);
  const ACTION_STYLES = useMemo(() => actionStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<ProjectReviewLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchProjectHistory(projectId)
      .then(setEntries)
      .catch((err: any) => {
        setError(err?.response?.data?.message ?? err?.message ?? 'Request failed');
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('founder.historyTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <ScrollView>
              {entries.length === 0 ? (
                <Text style={styles.empty}>{t('founder.historyEmpty')}</Text>
              ) : (
                entries.map((entry, index) => {
                  const meta = ACTION_STYLES[entry.action] ?? ACTION_STYLES.submitted;
                  const isPriorityChange = entry.action === 'priority_changed';
                  const changedFields = entry.changes && !isPriorityChange ? Object.keys(entry.changes) : [];
                  return (
                    <View key={entry.id} style={styles.entry}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryIcon}>{meta.icon}</Text>
                        <Text style={[styles.entryAction, { color: meta.color }]}>{t(meta.labelKey)}</Text>
                        <Text style={styles.entryDate}>{formatDateTime(entry.createdAt, i18n.language)}</Text>
                      </View>
                      {entry.moderatorName && (
                        <Text style={styles.entryModerator}>
                          {t('project.by')} {entry.moderatorName}
                        </Text>
                      )}
                      {index === 0 && entry.action === 'submitted' && !entry.changes && (
                        <Text style={styles.entryNote}>{t('founder.historyFirstSubmission')}</Text>
                      )}
                      {isPriorityChange && entry.changes && (
                        <View style={styles.priorityChangeRow}>
                          <View
                            style={[
                              styles.priorityDot,
                              { backgroundColor: PRIORITY_COLORS[entry.changes.from as ProjectPriority] },
                            ]}
                          />
                          <Text style={styles.entryNote}>{t(`project.priority.${entry.changes.from}`)}</Text>
                          <Text style={styles.entryNote}> → </Text>
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
                        <View style={styles.entryCommentBox}>
                          <RichTextView
                            html={entry.comment}
                            textStyle={styles.entryComment}
                            color={colors.text}
                            fontSize={13}
                          />
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: spacing.lg,
      maxHeight: '80%',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    closeIcon: {
      fontSize: 18,
      color: c.textMuted,
    },
    loader: {
      marginVertical: spacing.xl,
    },
    empty: {
      textAlign: 'center',
      color: c.textMuted,
      marginVertical: spacing.xl,
    },
    errorText: {
      textAlign: 'center',
      color: c.danger,
      marginVertical: spacing.xl,
    },
    entry: {
      borderLeftWidth: 2,
      borderLeftColor: c.border,
      paddingLeft: spacing.md,
      paddingBottom: spacing.md,
      marginBottom: spacing.xs,
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    entryIcon: {
      fontSize: 14,
      marginRight: spacing.xs,
    },
    entryAction: {
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },
    entryDate: {
      fontSize: 11,
      color: c.textMuted,
    },
    entryModerator: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    entryNote: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: spacing.xs,
    },
    priorityChangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 4,
    },
    entryCommentBox: {
      marginTop: spacing.xs,
    },
    entryComment: {
      fontSize: 13,
      color: c.text,
      fontStyle: 'italic',
    },
  });
