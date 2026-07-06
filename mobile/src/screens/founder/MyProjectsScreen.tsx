import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  cancelProjectDeletion,
  cancelProjectReview,
  fetchMyProjects,
  requestProjectDeletion,
  restoreProject,
} from '../../api/projects';
import { fetchPortfolio } from '../../api/portfolio';
import { cancelTicketListing, listTicketForSale } from '../../api/tickets';
import { resolveMediaUrl } from '../../api/client';
import { Holding, Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import {
  DIFF_FIELD_LABEL_KEYS,
  LOCALIZED_DIFF_FIELDS,
  formatDiffValue,
  formatLocalizedDiffText,
  getChangedLanguages,
} from '../../utils/projectDiff';
import { LANGUAGE_LABELS } from '../../i18n';
import { showAlert } from '../../utils/alert';
import { colors, spacing } from '../../theme';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RichTextView } from '../../components/RichTextView';
import { ProjectHistoryModal } from '../../components/ProjectHistoryModal';
import { HoldingCard } from '../../components/HoldingCard';
import { SellTicketModal } from '../../components/SellTicketModal';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

const RESTORE_WINDOW_DAYS = 7;

type Tab = 'owned' | 'invested';

type Props = NativeStackScreenProps<FounderStackParamList, 'MyProjects'>;

export function MyProjectsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('owned');
  const [projects, setProjects] = useState<Project[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [listingHolding, setListingHolding] = useState<Holding | null>(null);
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, portfolio] = await Promise.all([fetchMyProjects(), fetchPortfolio()]);
      setProjects(projectsData);
      setHoldings(portfolio.holdings);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleConfirmListing = async (quantity: number, askingPrice: number) => {
    if (!listingHolding) return;
    setListingSubmitting(true);
    try {
      await listTicketForSale(listingHolding.ticketIds, quantity, askingPrice);
      showAlert(t('portfolio.listingSuccess'));
      setListingHolding(null);
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setListingSubmitting(false);
    }
  };

  const handleCancelListing = async (ticketId: string) => {
    setCancellingId(ticketId);
    try {
      await cancelTicketListing(ticketId);
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setCancellingId(null);
    }
  };

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setActingId(id);
    try {
      await action();
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setActingId(null);
    }
  };

  const handleCancelReview = (id: string) => runAction(id, () => cancelProjectReview(id));
  const handleCancelDeletion = (id: string) => runAction(id, () => cancelProjectDeletion(id));
  const handleRestore = (id: string) => runAction(id, () => restoreProject(id));

  const handleDeleteProject = (item: Project) => {
    showAlert(
      t('founder.deleteConfirmTitle'),
      item.ticketsSold > 0 ? t('founder.deleteConfirmMessageWithInvestors') : t('founder.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('founder.deleteConfirmAction'),
          style: 'destructive',
          onPress: () => runAction(item.id, () => requestProjectDeletion(item.id)),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('founder.myProjects')}</Text>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === 'owned' && styles.tabActive]} onPress={() => setTab('owned')}>
          <Text style={[styles.tabText, tab === 'owned' && styles.tabTextActive]}>{t('founder.tabOwned')}</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'invested' && styles.tabActive]} onPress={() => setTab('invested')}>
          <Text style={[styles.tabText, tab === 'invested' && styles.tabTextActive]}>
            {t('founder.tabInvested')}
          </Text>
        </Pressable>
      </View>

      {tab === 'owned' && (
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.coverImageUrl ? (
              <Image source={{ uri: resolveMediaUrl(item.coverImageUrl) }} style={styles.cover} />
            ) : null}
            <Text style={styles.title}>{getLocalizedText(item.title, i18n.language)}</Text>
            <View style={styles.row}>
              <Text style={[styles.statusBadge, item.status === 'rejected' && styles.statusBadgeRejected]}>
                {t(`project.status.${item.status}`)}
              </Text>
              <Text style={styles.meta}>
                {parseFloat(item.collectedAmount).toLocaleString()} / {parseFloat(item.targetAmount).toLocaleString()}{' '}
                {t('common.currency')}
              </Text>
            </View>
            {!!item.reviewComment && (
              <View style={styles.reviewCommentBox}>
                <Text style={styles.reviewCommentLabel}>{t('founder.reviewCommentLabel')}:</Text>
                <RichTextView
                  html={item.reviewComment}
                  textStyle={styles.reviewComment}
                  color={colors.textMuted}
                  fontSize={12}
                />
              </View>
            )}
            <View style={styles.linksRow}>
              <Pressable style={styles.historyLink} onPress={() => setHistoryProjectId(item.id)}>
                <Text style={styles.historyLinkText}>{t('founder.historyTitle')}</Text>
              </Pressable>
              <Pressable
                style={styles.historyLink}
                onPress={() => navigation.navigate('ProjectFinance', { projectId: item.id })}
              >
                <Text style={styles.historyLinkText}>{t('project.finance.title')}</Text>
              </Pressable>
            </View>

            {item.deletedAt ? (
              (() => {
                const daysLeft =
                  RESTORE_WINDOW_DAYS -
                  Math.floor((Date.now() - new Date(item.deletedAt as string).getTime()) / (1000 * 60 * 60 * 24));
                return daysLeft > 0 ? (
                  <>
                    <Text style={styles.deletedNotice}>
                      {t('founder.deletedRestorableNotice', { days: daysLeft })}
                    </Text>
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => handleRestore(item.id)}
                        disabled={actingId === item.id}
                      >
                        <Text style={styles.actionButtonText}>{t('founder.restoreProject')}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text style={styles.deletedNotice}>{t('founder.deletedFinalNotice')}</Text>
                );
              })()
            ) : item.deletionRequestedAt ? (
              <>
                <Text style={styles.pendingNotice}>{t('founder.deletionPendingNotice')}</Text>
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleCancelDeletion(item.id)}
                    disabled={actingId === item.id}
                  >
                    <Text style={styles.actionButtonText}>{t('founder.cancelDeletionRequest')}</Text>
                  </Pressable>
                </View>
              </>
            ) : item.status === 'pending_review' ? (
              <>
                <Text style={styles.pendingNotice}>
                  {item.pendingChanges ? t('founder.editPendingNotice') : t('founder.reviewPendingNotice')}
                </Text>
                {item.pendingChanges && (
                  <View style={styles.diffBox}>
                    {item.pendingChangeReason && (
                      <View style={styles.founderNoteBox}>
                        <Text style={styles.founderNoteLabel}>{t('founder.pendingChangeReasonLabel')}</Text>
                        <Text style={styles.founderNoteText}>{item.pendingChangeReason}</Text>
                      </View>
                    )}
                    {Object.entries(item.pendingChanges).map(([field, newValue]) => {
                      if (LOCALIZED_DIFF_FIELDS.includes(field)) {
                        const oldValue = (item as any)[field];
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
                            {changedLangs.map((lang) => (
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
                            ))}
                          </View>
                        );
                      }
                      return (
                        <View key={field} style={styles.diffRow}>
                          <Text style={styles.diffLabel}>{t(DIFF_FIELD_LABEL_KEYS[field] ?? field)}</Text>
                          <View style={styles.diffValues}>
                            <Text style={styles.diffOld} numberOfLines={2}>
                              {formatDiffValue(field, (item as any)[field], t, i18n.language)}
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
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleCancelReview(item.id)}
                    disabled={actingId === item.id}
                  >
                    <Text style={styles.actionButtonText}>{t('founder.cancelReview')}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('CreateProject', { projectId: item.id })}
                >
                  <Text style={styles.actionButtonText}>{t('founder.editProject')}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => handleDeleteProject(item)}
                  disabled={actingId === item.id}
                >
                  <Text style={styles.deleteButtonText}>{t('founder.deleteProject')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>—</Text> : null}
      />
      )}

      {tab === 'invested' && (
        <FlatList
          data={holdings}
          keyExtractor={(item) => item.ticketId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HoldingCard
              holding={item}
              onPressTitle={() =>
                navigation.getParent()?.navigate(
                  'HomeTab',
                  { screen: 'ProjectDetail', params: { projectId: item.projectId } } as never,
                )
              }
              onSellPress={setListingHolding}
              onCancelListing={handleCancelListing}
              cancellingId={cancellingId}
            />
          )}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('portfolio.noHoldings')}</Text> : null}
        />
      )}

      {tab === 'owned' && (
        <View style={styles.footer}>
          <PrimaryButton title={t('founder.createProject')} onPress={() => navigation.navigate('CreateProject')} />
        </View>
      )}
      {historyProjectId && (
        <ProjectHistoryModal
          visible={!!historyProjectId}
          projectId={historyProjectId}
          onClose={() => setHistoryProjectId(null)}
        />
      )}

      <SellTicketModal
        holding={listingHolding}
        submitting={listingSubmitting}
        onClose={() => setListingHolding(null)}
        onConfirm={handleConfirmListing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cover: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: spacing.sm,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    color: colors.textMuted,
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statusBadgeRejected: {
    color: colors.danger,
  },
  reviewCommentBox: {
    marginTop: spacing.xs,
  },
  reviewCommentLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  reviewComment: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  linksRow: {
    flexDirection: 'row',
  },
  historyLink: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    marginRight: spacing.lg,
  },
  historyLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  actionButton: {
    marginRight: spacing.lg,
  },
  actionButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  pendingNotice: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  deletedNotice: {
    fontSize: 12,
    color: colors.danger,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  diffBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  founderNoteBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  founderNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  founderNoteText: {
    fontSize: 12,
    color: colors.text,
    fontStyle: 'italic',
  },
  diffRow: {
    marginBottom: spacing.xs,
  },
  diffLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 1,
  },
  diffLangSummary: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
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
  diffLangTag: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: spacing.xs,
  },
  diffOld: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  diffArrow: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  diffNew: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
  },
});
