import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ProjectBudgetItem, ProjectWork, WorkApplication, WorkMilestone, WorkPaymentType } from '../types';
import {
  acceptMilestone,
  acceptWork,
  addWorkMilestones,
  applyToWork,
  cancelWork,
  createProjectWork,
  deleteProjectWork,
  disputeWork,
  fetchProjectWorks,
  fetchWorkApplications,
  fetchWorkMilestones,
  rejectApplication,
  reviewWork,
  selectWorkApplicant,
  submitMilestone,
  submitWork,
  updateApplication,
  updateProjectWork,
} from '../api/projectWorks';
import { fetchProjectBudgetItems } from '../api/projects';
import { showAlert } from '../utils/alert';
import { colors, spacing } from '../theme';
import { Avatar } from './Avatar';
import { PrimaryButton } from './PrimaryButton';
import { TextField } from './TextField';

interface Props {
  projectId: string;
  canEdit: boolean;
  currentUserId?: string;
  treasuryBalance?: number;
  spendableBalance?: number;
  onChanged?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: colors.primary,
  assigned: colors.warning,
  submitted: colors.chartAccent,
  accepted: colors.success,
  disputed: colors.danger,
  cancelled: colors.textMuted,
};

export function ProjectWorksPanel({
  projectId,
  canEdit,
  currentUserId,
  treasuryBalance,
  spendableBalance,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const [works, setWorks] = useState<ProjectWork[]>([]);
  const [budgetItems, setBudgetItems] = useState<ProjectBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // create/edit-work modal
  const [createVisible, setCreateVisible] = useState(false);
  const [editWorkId, setEditWorkId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [price, setPrice] = useState('');
  const [allowCounter, setAllowCounter] = useState(false);
  const [budgetItemId, setBudgetItemId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<WorkPaymentType>('cash');
  const [premium, setPremium] = useState('');

  // apply modal
  const [applyWork, setApplyWork] = useState<ProjectWork | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [preferredPayment, setPreferredPayment] = useState<WorkPaymentType>('cash');

  // applications modal
  const [appsWork, setAppsWork] = useState<ProjectWork | null>(null);
  const [applications, setApplications] = useState<WorkApplication[]>([]);
  const [rejectApp, setRejectApp] = useState<WorkApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // rating modal
  const [rateWork, setRateWork] = useState<ProjectWork | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  // milestones (fetched per expanded work)
  const [milestones, setMilestones] = useState<Record<string, WorkMilestone[]>>({});
  const [milestoneRows, setMilestoneRows] = useState<Array<{ title: string; amount: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [worksData, itemsData] = await Promise.all([
        fetchProjectWorks(projectId),
        fetchProjectBudgetItems(projectId).catch(() => [] as ProjectBudgetItem[]),
      ]);
      setWorks(worksData);
      setBudgetItems(itemsData);
      const milestoneEntries = await Promise.all(
        worksData.map(async (w) => [w.id, await fetchWorkMilestones(projectId, w.id).catch(() => [])] as const),
      );
      setMilestones(Object.fromEntries(milestoneEntries));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    onChanged?.();
  };

  const resetWorkForm = () => {
    setTitle('');
    setBrief('');
    setPrice('');
    setAllowCounter(false);
    setBudgetItemId(null);
    setPaymentType('cash');
    setPremium('');
    setMilestoneRows([]);
    setEditWorkId(null);
  };

  const openCreate = () => {
    resetWorkForm();
    setCreateVisible(true);
  };

  const openEdit = (work: ProjectWork) => {
    setEditWorkId(work.id);
    setTitle(work.title);
    setBrief(work.brief);
    setPrice(String(work.price));
    setAllowCounter(work.allowCounterOffers);
    setBudgetItemId(work.budgetItemId);
    setPaymentType(work.paymentType);
    setPremium(work.ticketPremiumPercent > 0 ? String(work.ticketPremiumPercent) : '');
    setMilestoneRows([]);
    setCreateVisible(true);
  };

  const handleCreate = async () => {
    const amount = parseFloat(price);
    if (!title.trim() || !brief.trim() || !amount || amount <= 0) {
      showAlert(t('common.error'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        brief: brief.trim(),
        price: amount,
        allowCounterOffers: allowCounter,
        paymentType,
        ticketPremiumPercent: paymentType !== 'cash' && premium ? parseFloat(premium) : 0,
        budgetItemId: budgetItemId ?? undefined,
      };
      if (editWorkId) {
        await updateProjectWork(projectId, editWorkId, payload);
      } else {
        const created = await createProjectWork(projectId, payload);
        const validMilestones = milestoneRows
          .filter((r) => r.title.trim() && parseFloat(r.amount) > 0)
          .map((r) => ({ title: r.title.trim(), amount: parseFloat(r.amount) }));
        if (validMilestones.length > 0) {
          await addWorkMilestones(projectId, created.id, validMilestones);
        }
      }
      setCreateVisible(false);
      resetWorkForm();
      refresh();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const openApply = (work: ProjectWork) => {
    setApplyWork(work);
    const mine = work.myApplication;
    setCoverLetter(mine?.coverLetter ?? '');
    setOfferedPrice(mine?.offeredPrice != null ? String(mine.offeredPrice) : '');
    setPreferredPayment(mine?.preferredPayment ?? (work.paymentType === 'tickets' ? 'tickets' : 'cash'));
  };

  const handleApply = async () => {
    if (!applyWork) return;
    setSubmitting(true);
    try {
      const payload = {
        coverLetter: coverLetter.trim() || undefined,
        offeredPrice: applyWork.allowCounterOffers && offeredPrice ? parseFloat(offeredPrice) : undefined,
        preferredPayment: applyWork.paymentType === 'either' ? preferredPayment : undefined,
      };
      if (applyWork.myApplication) {
        await updateApplication(projectId, applyWork.id, payload);
      } else {
        await applyToWork(projectId, applyWork.id, payload);
      }
      setApplyWork(null);
      showAlert(t('works.applied'));
      refresh();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const openApplications = async (work: ProjectWork) => {
    setAppsWork(work);
    setApplications([]);
    try {
      setApplications(await fetchWorkApplications(projectId, work.id));
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    }
  };

  const handleSelect = async (app: WorkApplication) => {
    if (!appsWork) return;
    const needed = app.offeredPrice ?? appsWork.price;
    // Clear, upfront reason instead of a raw backend error: the stage funds
    // must be released before a worker can be paid from them.
    if (spendableBalance !== undefined && spendableBalance < needed) {
      showAlert(t('works.selectNoFundsTitle'), t('works.selectNoFunds'));
      return;
    }
    setSubmitting(true);
    try {
      await selectWorkApplicant(projectId, appsWork.id, app.id);
      setAppsWork(null);
      refresh();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!appsWork || !rejectApp) return;
    setSubmitting(true);
    try {
      await rejectApplication(projectId, appsWork.id, rejectApp.id, rejectReason.trim() || undefined);
      setRejectApp(null);
      setRejectReason('');
      await openApplications(appsWork);
      refresh();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const runWorkAction = async (fn: () => Promise<unknown>) => {
    setSubmitting(true);
    try {
      await fn();
      refresh();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const openRate = (work: ProjectWork) => {
    setRateWork(work);
    setRatingValue(work.review?.rating ?? 5);
    setRatingComment(work.review?.comment ?? '');
  };

  const handleRate = async () => {
    if (!rateWork) return;
    setSubmitting(true);
    try {
      await reviewWork(projectId, rateWork.id, ratingValue, ratingComment.trim() || undefined);
      setRateWork(null);
      setRatingValue(5);
      setRatingComment('');
      refresh();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = (work: ProjectWork) => {
    showAlert(t('works.disputeConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('works.dispute'), style: 'destructive', onPress: () => runWorkAction(() => disputeWork(projectId, work.id)) },
    ]);
  };

  const currency = t('common.currency');

  return (
    <View>
      <Text style={styles.caption}>{t('works.caption')}</Text>

      {canEdit && (treasuryBalance !== undefined || spendableBalance !== undefined) && (
        <View style={styles.treasuryRow}>
          <View style={styles.treasuryCell}>
            <Text style={styles.treasuryLabel}>{t('works.treasuryFrozen')}</Text>
            <Text style={styles.treasuryValue}>
              {(treasuryBalance ?? 0).toLocaleString()} {currency}
            </Text>
          </View>
          <View style={styles.treasuryCell}>
            <Text style={styles.treasuryLabel}>{t('works.treasuryAvailable')}</Text>
            <Text style={[styles.treasuryValue, { color: colors.success }]}>
              {(spendableBalance ?? 0).toLocaleString()} {currency}
            </Text>
          </View>
        </View>
      )}

      {canEdit && (
        <View style={styles.createButton}>
          <PrimaryButton title={t('works.createWork')} onPress={openCreate} />
        </View>
      )}

      {!loading && works.length === 0 && <Text style={styles.empty}>{t('works.noWorks')}</Text>}

      {works.map((work) => {
        const isAssignee = work.assigneeId === currentUserId;
        const canApply = !canEdit && work.status === 'open' && !isAssignee;
        const workMilestones = milestones[work.id] ?? [];
        const hasMilestones = workMilestones.length > 0;
        const inProgress = work.status === 'assigned' || work.status === 'submitted';
        return (
          <View key={work.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{work.title}</Text>
              <View style={[styles.statusChip, { backgroundColor: `${STATUS_COLORS[work.status]}22` }]}>
                <Text style={[styles.statusChipText, { color: STATUS_COLORS[work.status] }]}>
                  {t(`works.status.${work.status}`)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardBrief}>{work.brief}</Text>
            <Text style={styles.cardPrice}>
              {work.price.toLocaleString()} {currency}
              {work.allowCounterOffers ? ` · ${t('works.counterOffersOn')}` : ''}
            </Text>
            <Text style={styles.cardMeta}>
              {t(`works.payment.${work.paymentType}`)}
              {work.ticketPremiumPercent > 0 ? ` · +${work.ticketPremiumPercent}% ${t('works.asTickets')}` : ''}
            </Text>

            {canEdit && work.status === 'open' && (
              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtn} onPress={() => openApplications(work)}>
                  <Text style={styles.actionBtnText}>
                    {t('works.applicationsCount', { count: work.applicationsCount })}
                  </Text>
                </Pressable>
                <View style={styles.rowRight}>
                  <Pressable onPress={() => openEdit(work)}>
                    <Text style={styles.editLink}>{t('works.editWork')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      showAlert(t('common.confirm'), undefined, [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: () => runWorkAction(() => deleteProjectWork(projectId, work.id)) },
                      ])
                    }
                  >
                    <Text style={styles.deleteLink}>{t('common.delete')}</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {/* Milestones */}
            {hasMilestones && (
              <View style={styles.milestones}>
                {workMilestones.map((m) => (
                  <View key={m.id} style={styles.milestoneRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.milestoneTitle}>{m.title}</Text>
                      <Text style={styles.milestoneMeta}>
                        {parseFloat(m.amount).toLocaleString()} {currency} · {t(`works.milestoneStatus.${m.status}`)}
                      </Text>
                    </View>
                    {isAssignee && m.status === 'pending' && (
                      <Pressable style={styles.miniBtn} onPress={() => runWorkAction(() => submitMilestone(projectId, work.id, m.id))}>
                        <Text style={styles.miniBtnText}>{t('works.submitWork')}</Text>
                      </Pressable>
                    )}
                    {canEdit && m.status === 'submitted' && (
                      <Pressable style={styles.miniBtn} onPress={() => runWorkAction(() => acceptMilestone(projectId, work.id, m.id))}>
                        <Text style={styles.miniBtnText}>{t('works.accept')}</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {canEdit && work.status === 'submitted' && !hasMilestones && (
              <View style={styles.actionRow}>
                <View style={styles.flex1}>
                  <PrimaryButton title={t('works.accept')} onPress={() => runWorkAction(() => acceptWork(projectId, work.id))} loading={submitting} />
                </View>
                <Pressable onPress={() => runWorkAction(() => cancelWork(projectId, work.id))}>
                  <Text style={styles.deleteLink}>{t('works.cancelRefund')}</Text>
                </Pressable>
              </View>
            )}
            {isAssignee && work.status === 'assigned' && !hasMilestones && (
              <View style={styles.createButton}>
                <PrimaryButton title={t('works.submitWork')} onPress={() => runWorkAction(() => submitWork(projectId, work.id))} loading={submitting} />
              </View>
            )}
            {(canEdit || isAssignee) && inProgress && (
              <Pressable onPress={() => handleDispute(work)}>
                <Text style={styles.disputeLink}>⚠ {t('works.dispute')}</Text>
              </Pressable>
            )}
            {canEdit && work.status === 'accepted' && (
              <>
                <Pressable style={styles.rateBtn} onPress={() => openRate(work)}>
                  <Text style={styles.rateBtnText}>
                    ★ {work.review ? t('works.editRating') : t('works.rateWorker')}
                  </Text>
                </Pressable>
                {work.review && (
                  <View style={styles.reviewBox}>
                    <Text style={styles.reviewStars}>
                      {'★'.repeat(work.review.rating)}
                      <Text style={styles.reviewStarsEmpty}>{'★'.repeat(5 - work.review.rating)}</Text>
                    </Text>
                    {!!work.review.comment && <Text style={styles.reviewComment}>{work.review.comment}</Text>}
                  </View>
                )}
              </>
            )}
            {canApply &&
              (work.myApplication ? (
                <View style={styles.appliedBox}>
                  <Text style={styles.appliedText}>
                    {t('works.youApplied')} · {t(`works.appStatus.${work.myApplication.status}`)}
                  </Text>
                  {work.myApplication.status === 'rejected' && !!work.myApplication.decisionReason && (
                    <Text style={styles.appliedReason}>{work.myApplication.decisionReason}</Text>
                  )}
                  {work.myApplication.status === 'pending' && (
                    <Pressable onPress={() => openApply(work)}>
                      <Text style={styles.editLink}>{t('works.editApplication')}</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={styles.createButton}>
                  <PrimaryButton title={t('works.apply')} variant="outline" onPress={() => openApply(work)} />
                </View>
              ))}
          </View>
        );
      })}

      {/* Create work modal */}
      <Modal visible={createVisible} transparent animationType="fade" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editWorkId ? t('works.editWork') : t('works.createWork')}</Text>
              <TextField label={t('works.titleLabel')} value={title} onChangeText={setTitle} />
              <TextField label={t('works.briefLabel')} value={brief} onChangeText={setBrief} multiline />
              <TextField label={t('works.priceLabel')} value={price} onChangeText={setPrice} format="decimal" keyboardType="decimal-pad" />

              <Text style={styles.pickerLabel}>{t('works.paymentTypeLabel')}</Text>
              <View style={styles.chipRow}>
                {(['cash', 'tickets', 'either'] as WorkPaymentType[]).map((pt) => (
                  <Pressable
                    key={pt}
                    style={[styles.chip, paymentType === pt && styles.chipActive]}
                    onPress={() => setPaymentType(pt)}
                  >
                    <Text style={[styles.chipText, paymentType === pt && styles.chipTextActive]}>
                      {t(`works.payment.${pt}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {paymentType !== 'cash' && (
                <TextField
                  label={t('works.premiumLabel')}
                  value={premium}
                  onChangeText={setPremium}
                  format="decimal"
                  keyboardType="decimal-pad"
                  hint={t('works.premiumHint')}
                />
              )}

              {budgetItems.length > 0 && (
                <>
                  <Text style={styles.pickerLabel}>{t('works.stageLabel')}</Text>
                  <View style={styles.chipRow}>
                    {budgetItems.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.chip, budgetItemId === item.id && styles.chipActive]}
                        onPress={() => setBudgetItemId(budgetItemId === item.id ? null : item.id)}
                      >
                        <Text style={[styles.chipText, budgetItemId === item.id && styles.chipTextActive]}>{item.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('works.allowCounterOffers')}</Text>
                <Switch value={allowCounter} onValueChange={setAllowCounter} />
              </View>

              <Text style={styles.pickerLabel}>{t('works.milestonesLabel')}</Text>
              {milestoneRows.map((row, i) => (
                <View key={i}>
                  <TextField
                    label={t('works.milestoneTitle')}
                    value={row.title}
                    onChangeText={(v) => setMilestoneRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, title: v } : r)))}
                  />
                  <TextField
                    label={t('works.priceLabel')}
                    value={row.amount}
                    onChangeText={(v) => setMilestoneRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, amount: v } : r)))}
                    format="decimal"
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
              <Pressable onPress={() => setMilestoneRows((rows) => [...rows, { title: '', amount: '' }])}>
                <Text style={styles.addRowText}>+ {t('works.addMilestone')}</Text>
              </Pressable>

              <PrimaryButton title={t('common.save')} onPress={handleCreate} loading={submitting} />
              <Pressable style={styles.modalCancel} onPress={() => setCreateVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Apply modal */}
      <Modal visible={!!applyWork} transparent animationType="fade" onRequestClose={() => setApplyWork(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{applyWork?.title}</Text>
            <TextField label={t('works.coverLetter')} value={coverLetter} onChangeText={setCoverLetter} multiline />
            {applyWork?.allowCounterOffers && (
              <TextField label={t('works.yourPrice')} value={offeredPrice} onChangeText={setOfferedPrice} format="decimal" keyboardType="decimal-pad" />
            )}
            {applyWork?.paymentType === 'either' && (
              <>
                <Text style={styles.pickerLabel}>{t('works.howPaid')}</Text>
                <View style={styles.chipRow}>
                  {(['cash', 'tickets'] as WorkPaymentType[]).map((pt) => (
                    <Pressable
                      key={pt}
                      style={[styles.chip, preferredPayment === pt && styles.chipActive]}
                      onPress={() => setPreferredPayment(pt)}
                    >
                      <Text style={[styles.chipText, preferredPayment === pt && styles.chipTextActive]}>
                        {t(`works.payment.${pt}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {!!applyWork &&
              applyWork.ticketPremiumPercent > 0 &&
              (applyWork.paymentType === 'tickets' ||
                (applyWork.paymentType === 'either' && preferredPayment === 'tickets')) && (
                <Text style={styles.premiumNote}>
                  {t('works.premiumNote', { percent: applyWork.ticketPremiumPercent })}
                </Text>
              )}
            <PrimaryButton title={t('works.apply')} onPress={handleApply} loading={submitting} />
            <Pressable style={styles.modalCancel} onPress={() => setApplyWork(null)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Applications modal */}
      <Modal visible={!!appsWork} transparent animationType="fade" onRequestClose={() => setAppsWork(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('works.applicationsTitle')}</Text>
            <ScrollView>
              {applications.length === 0 && <Text style={styles.empty}>{t('works.noApplications')}</Text>}
              {applications.map((app) => (
                <View key={app.id} style={styles.appRow}>
                  <Avatar avatarUrl={app.avatarUrl} avatarEmoji={app.avatarEmoji} size={36} />
                  <View style={styles.appText}>
                    <Text style={styles.appName}>{app.fullName || app.username || '—'}</Text>
                    {!!app.coverLetter && <Text style={styles.appCover}>{app.coverLetter}</Text>}
                    {app.offeredPrice !== null && (
                      <Text style={styles.appPrice}>
                        {app.offeredPrice.toLocaleString()} {currency}
                      </Text>
                    )}
                  </View>
                  {app.status === 'selected' ? (
                    <Text style={styles.selectedTag}>{t('works.status.assigned')}</Text>
                  ) : app.status === 'rejected' ? (
                    <Text style={styles.rejectedTag}>{t('works.appStatus.rejected')}</Text>
                  ) : (
                    <View style={styles.appActions}>
                      <Pressable style={styles.selectBtn} onPress={() => handleSelect(app)} disabled={submitting}>
                        <Text style={styles.selectBtnText}>{t('works.select')}</Text>
                      </Pressable>
                      <Pressable onPress={() => setRejectApp(app)} disabled={submitting}>
                        <Text style={styles.rejectLink}>{t('works.reject')}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setAppsWork(null)}>
              <Text style={styles.modalCancelText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Rating modal */}
      <Modal visible={!!rateWork} transparent animationType="fade" onRequestClose={() => setRateWork(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{rateWork?.review ? t('works.editRating') : t('works.rateWorker')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRatingValue(n)}>
                  <Text style={[styles.star, n <= ratingValue && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextField label={t('works.ratingComment')} value={ratingComment} onChangeText={setRatingComment} multiline />
            <PrimaryButton title={t('common.save')} onPress={handleRate} loading={submitting} />
            <Pressable style={styles.modalCancel} onPress={() => setRateWork(null)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Reject application modal */}
      <Modal visible={!!rejectApp} transparent animationType="fade" onRequestClose={() => setRejectApp(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('works.rejectTitle')}</Text>
            <TextField
              label={t('works.rejectReason')}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <PrimaryButton title={t('works.reject')} onPress={confirmReject} loading={submitting} />
            <Pressable style={styles.modalCancel} onPress={() => setRejectApp(null)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.md },
  treasuryRow: { flexDirection: 'row', marginBottom: spacing.md },
  treasuryCell: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.sm,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  treasuryLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  treasuryValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  createButton: { marginBottom: spacing.md },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, marginRight: spacing.sm },
  statusChip: { borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  cardBrief: { fontSize: 13, color: colors.text, marginTop: 4 },
  cardPrice: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 4 },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  premiumNote: { fontSize: 12, color: colors.success, fontWeight: '600', marginBottom: spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  actionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  deleteLink: { fontSize: 12, fontWeight: '600', color: colors.danger, marginLeft: spacing.sm },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  editLink: { fontSize: 12, fontWeight: '600', color: colors.primary, marginLeft: spacing.sm },
  appliedBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
  },
  appliedText: { fontSize: 13, fontWeight: '600', color: colors.text },
  appliedReason: { fontSize: 12, color: colors.danger, marginTop: 2 },
  appActions: { flexDirection: 'row', alignItems: 'center' },
  rejectedTag: { fontSize: 11, fontWeight: '700', color: colors.danger },
  rejectLink: { fontSize: 12, fontWeight: '600', color: colors.danger, marginLeft: spacing.md },
  flex1: { flex: 1, marginRight: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  pickerLabel: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  switchLabel: { flex: 1, fontSize: 14, color: colors.text, marginRight: spacing.sm },
  modalCancel: { alignItems: 'center', paddingVertical: spacing.md },
  modalCancelText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  appText: { flex: 1, marginLeft: spacing.sm },
  appName: { fontSize: 14, fontWeight: '600', color: colors.text },
  appCover: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  appPrice: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 2 },
  selectBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  selectedTag: { fontSize: 11, fontWeight: '700', color: colors.warning },
  milestones: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xs },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  milestoneTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  milestoneMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  miniBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  miniBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  addRowText: { color: colors.primary, fontWeight: '700', fontSize: 13, marginBottom: spacing.md },
  disputeLink: { fontSize: 12, fontWeight: '600', color: colors.warning, marginTop: spacing.sm },
  rateBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  rateBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  reviewBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.sm,
  },
  reviewStars: { fontSize: 16, color: colors.warning, letterSpacing: 2 },
  reviewStarsEmpty: { color: colors.border },
  reviewComment: { fontSize: 13, color: colors.text, marginTop: 4 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md },
  star: { fontSize: 34, color: colors.border, marginHorizontal: 4 },
  starActive: { color: colors.warning },
});
