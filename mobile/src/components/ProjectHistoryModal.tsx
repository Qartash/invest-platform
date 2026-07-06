import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchProjectHistory } from '../api/projects';
import { ProjectReviewLogEntry } from '../types';
import { formatDateTime } from '../utils/date';
import { DIFF_FIELD_LABEL_KEYS } from '../utils/projectDiff';
import { PRIORITY_COLORS, ProjectPriority } from '../utils/priority';
import { colors, spacing } from '../theme';
import { RichTextView } from './RichTextView';

interface Props {
  visible: boolean;
  projectId: string;
  onClose: () => void;
}

const ACTION_STYLES: Record<string, { icon: string; labelKey: string; color: string }> = {
  submitted: { icon: '📝', labelKey: 'founder.historySubmitted', color: colors.primary },
  approved: { icon: '✅', labelKey: 'founder.historyApproved', color: colors.success },
  rejected: { icon: '❌', labelKey: 'founder.historyRejected', color: colors.danger },
  cancelled: { icon: '↩️', labelKey: 'founder.historyCancelled', color: colors.textMuted },
  deletion_requested: { icon: '🗑', labelKey: 'founder.historyDeletionRequested', color: colors.danger },
  deletion_approved: { icon: '🗑', labelKey: 'founder.historyDeletionApproved', color: colors.danger },
  deletion_rejected: { icon: '🛡', labelKey: 'founder.historyDeletionRejected', color: colors.success },
  deleted: { icon: '🗑', labelKey: 'founder.historyDeleted', color: colors.danger },
  restored: { icon: '♻️', labelKey: 'founder.historyRestored', color: colors.success },
  priority_changed: { icon: '🚩', labelKey: 'founder.historyPriorityChanged', color: colors.textMuted },
};

export function ProjectHistoryModal({ visible, projectId, onClose }: Props) {
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  closeIcon: {
    fontSize: 18,
    color: colors.textMuted,
  },
  loader: {
    marginVertical: spacing.xl,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginVertical: spacing.xl,
  },
  errorText: {
    textAlign: 'center',
    color: colors.danger,
    marginVertical: spacing.xl,
  },
  entry: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
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
    color: colors.textMuted,
  },
  entryModerator: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  entryNote: {
    fontSize: 12,
    color: colors.textMuted,
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
    color: colors.text,
    fontStyle: 'italic',
  },
});
