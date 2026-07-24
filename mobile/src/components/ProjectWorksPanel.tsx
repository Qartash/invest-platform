import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';
import { maxWidth, spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { Dialog } from './ui';
import { Avatar } from './Avatar';
import { InvestorProfileModal } from './InvestorProfileModal';
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

// Work status -> colour, built per palette so the chips follow the theme.
const statusColors = (c: ThemeColors): Record<string, string> => ({
  open: c.primary,
  assigned: c.warning,
  submitted: c.chartAccent,
  accepted: c.success,
  disputed: c.danger,
  cancelled: c.textMuted,
});

export function ProjectWorksPanel({
  projectId,
  canEdit,
  currentUserId,
  treasuryBalance,
  spendableBalance,
  onChanged,
}: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const STATUS_COLORS = useMemo(() => statusColors(colors), [colors]);
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
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
  const [selectApp, setSelectApp] = useState<WorkApplication | null>(null);
  const [selectAmount, setSelectAmount] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

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
    // Prefill the existing milestones so they can be seen and edited, instead
    // of showing an empty list.
    const existing = milestones[work.id] ?? [];
    setMilestoneRows(existing.map((m) => ({ title: m.title, amount: String(parseFloat(m.amount)) })));
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
      const validMilestones = milestoneRows
        .filter((r) => r.title.trim() && parseFloat(r.amount) > 0)
        .map((r) => ({ title: r.title.trim(), amount: parseFloat(r.amount) }));
      if (editWorkId) {
        await updateProjectWork(projectId, editWorkId, payload);
        // Milestones are only editable while the work is open; sync them so
        // added/changed rows are saved (backend replaces the full set).
        if (validMilestones.length > 0) {
          await addWorkMilestones(projectId, editWorkId, validMilestones);
        }
      } else {
        const created = await createProjectWork(projectId, payload);
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
      // Editing a still-pending application updates it in place; a first-time
      // or post-rejection apply goes through applyToWork (which revives a
      // previously rejected row on the backend).
      if (applyWork.myApplication?.status === 'pending') {
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

  // Open the "freeze amount" confirmation, prefilled with the applicant's
  // offered price (or the work's price). The founder can adjust it to the
  // actually-agreed sum before assigning.
  const openSelect = (app: WorkApplication) => {
    if (!appsWork) return;
    setSelectApp(app);
    setSelectAmount(String(app.offeredPrice ?? appsWork.price));
  };

  const selectPayment =
    appsWork && selectApp
      ? appsWork.paymentType === 'either'
        ? selectApp.preferredPayment
        : appsWork.paymentType
      : 'cash';
  // Amount actually frozen from the treasury: the entered sum, plus the ticket
  // premium when the worker is paid in tickets.
  const selectFrozen =
    (parseFloat(selectAmount) || 0) *
    (selectPayment === 'tickets' && appsWork ? 1 + appsWork.ticketPremiumPercent / 100 : 1);

  const confirmSelect = async () => {
    if (!appsWork || !selectApp) return;
    const amount = parseFloat(selectAmount);
    if (!amount || amount <= 0) {
      showAlert(t('common.error'));
      return;
    }
    // Availability is checked against the agreed amount (+premium), not the
    // work's original planned price.
    if (spendableBalance !== undefined && spendableBalance < selectFrozen) {
      showAlert(t('works.selectNoFundsTitle'), t('works.selectNoFunds'));
      return;
    }
    setSubmitting(true);
    try {
      await selectWorkApplicant(projectId, appsWork.id, selectApp.id, amount);
      setSelectApp(null);
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
  const fmtNum = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Live hint under the counter-offer field: how the entered price compares to
  // the work's original price.
  const applyBase = applyWork?.price ?? 0;
  const offeredNum = parseFloat(offeredPrice);
  const offeredPriceHint = !applyWork
    ? undefined
    : !offeredPrice || Number.isNaN(offeredNum)
      ? t('works.priceVsOriginalEmpty', { price: fmtNum(applyBase), currency })
      : offeredNum > applyBase
        ? t('works.priceHigher', { amount: fmtNum(offeredNum - applyBase), price: fmtNum(applyBase), currency })
        : offeredNum < applyBase
          ? t('works.priceLower', { amount: fmtNum(applyBase - offeredNum), price: fmtNum(applyBase), currency })
          : t('works.priceSame', { price: fmtNum(applyBase), currency });

  // Whether the employer will actually be able to see this applicant's contacts
  // on their profile. Mirrors the backend rule in investor-profile.ts:
  // contacts are exposed only when the name isn't masked, sharing is on, and a
  // contact is actually filled in. Otherwise we nudge them to add a contact to
  // the cover letter instead.
  const contactsVisibleToEmployer =
    user?.showFullName !== false &&
    !!user?.shareContactsPublicly &&
    !!(user?.telegram || user?.linkedin);

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
        // Once a work is taken, the frozen escrow is what will actually be paid;
        // with a counter-offer (or ticket premium) that differs from the planned
        // amounts. We show BOTH: the planned figure and the real one. For paid
        // milestones the real amount is stored; while still in progress it's the
        // projected share of escrow (ratio stays constant as milestones are paid).
        const hasAssignee = work.assigneeId != null && work.escrowAmount != null;
        const milestoneSum = workMilestones.reduce((s, m) => s + parseFloat(m.amount), 0);
        const unpaidSum = workMilestones
          .filter((m) => m.status !== 'accepted')
          .reduce((s, m) => s + parseFloat(m.amount), 0);
        const payoutRatio = hasAssignee && unpaidSum > 0 ? work.escrowAmount! / unpaidSum : 1;
        const effectiveMilestone = (m: WorkMilestone) =>
          m.paidAmount != null ? parseFloat(m.paidAmount) : parseFloat(m.amount) * payoutRatio;
        const plannedTotal = hasMilestones ? milestoneSum : work.price;
        const effectiveTotal = hasMilestones
          ? workMilestones.reduce((s, m) => s + effectiveMilestone(m), 0)
          : hasAssignee
            ? work.escrowAmount!
            : work.price;
        const totalDiffers = Math.abs(effectiveTotal - plannedTotal) > 0.005;
        const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
              {totalDiffers && <Text style={styles.plannedStrike}>{fmt(plannedTotal)} → </Text>}
              {fmt(effectiveTotal)} {currency}
              {work.allowCounterOffers && work.status === 'open' ? ` · ${t('works.counterOffersOn')}` : ''}
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
                {workMilestones.map((m) => {
                  const planned = parseFloat(m.amount);
                  const effective = effectiveMilestone(m);
                  const differs = Math.abs(effective - planned) > 0.005;
                  return (
                  <View key={m.id} style={styles.milestoneRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.milestoneTitle}>{m.title}</Text>
                      <Text style={styles.milestoneMeta}>
                        {differs && <Text style={styles.plannedStrike}>{fmt(planned)} → </Text>}
                        {fmt(effective)} {currency} · {t(`works.milestoneStatus.${m.status}`)}
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
                  );
                })}
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
                  {work.myApplication.status === 'rejected' && (
                    <Pressable onPress={() => openApply(work)}>
                      <Text style={styles.editLink}>{t('works.reapply')}</Text>
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
      <Dialog visible={createVisible} onClose={() => setCreateVisible(false)} maxWidth={maxWidth.dialogMd}>
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
      </Dialog>

      {/* Apply modal */}
      <Dialog visible={!!applyWork} onClose={() => setApplyWork(null)} maxWidth={maxWidth.dialogMd}>
        <View style={styles.modalCard}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{applyWork?.title}</Text>
            <Text style={styles.applyPrice}>
              {t('works.basePriceLine', { price: fmtNum(applyBase), currency })}
              {applyWork?.allowCounterOffers ? ` · ${t('works.counterOffersOn')}` : ''}
            </Text>
            {contactsVisibleToEmployer ? (
              <Text style={styles.contactsOkNote}>{t('works.contactsVisibleNote')}</Text>
            ) : (
              <View style={styles.contactsWarnBox}>
                <Text style={styles.contactsWarnText}>{t('works.contactsHiddenNote')}</Text>
              </View>
            )}
            <TextField
              label={t('works.coverLetter')}
              value={coverLetter}
              onChangeText={setCoverLetter}
              multiline
              placeholder={t('works.coverLetterPlaceholder')}
              hint={t('works.coverLetterHint')}
            />
            {applyWork?.allowCounterOffers && (
              <TextField
                label={t('works.yourPrice')}
                value={offeredPrice}
                onChangeText={setOfferedPrice}
                format="decimal"
                keyboardType="decimal-pad"
                hint={offeredPriceHint}
              />
            )}
            {applyWork?.paymentType === 'either' && (
              <>
                <Text style={styles.pickerLabel}>{t('works.howPaid')}</Text>
                <Text style={styles.paymentHint}>{t('works.paymentExplainHint')}</Text>
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
          </ScrollView>
        </View>
      </Dialog>

      {/* Applications modal */}
      <Dialog visible={!!appsWork} onClose={() => setAppsWork(null)} maxWidth={maxWidth.dialogMd}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('works.applicationsTitle')}</Text>
          <ScrollView>
            {applications.length === 0 && <Text style={styles.empty}>{t('works.noApplications')}</Text>}
            {applications.map((app) => {
              const base = appsWork?.price ?? 0;
              const offered = app.offeredPrice ?? base;
              const diff = offered - base;
              return (
              <View key={app.id} style={styles.appRow}>
                <Pressable style={styles.appText} onPress={() => setProfileUserId(app.applicantId)}>
                  <View style={styles.appNameRow}>
                    <Avatar avatarUrl={app.avatarUrl} avatarEmoji={app.avatarEmoji} size={36} />
                    <View style={styles.appNameText}>
                      <Text style={styles.appName}>{app.fullName || app.username || '—'}</Text>
                      <Text style={styles.viewProfileLink}>{t('works.viewProfile')} ›</Text>
                    </View>
                  </View>
                  {!!app.coverLetter && <Text style={styles.appCover}>{app.coverLetter}</Text>}
                  <Text style={styles.appPrice}>
                    {fmtNum(offered)} {currency}
                    {diff !== 0 && (
                      <Text style={diff > 0 ? styles.priceUp : styles.priceDown}>
                        {'  '}
                        {diff > 0 ? '▲' : '▼'} {fmtNum(Math.abs(diff))} · {t('works.wasPrice', { price: fmtNum(base) })}
                      </Text>
                    )}
                  </Text>
                </Pressable>
                {app.status === 'selected' ? (
                  <Text style={styles.selectedTag}>{t('works.status.assigned')}</Text>
                ) : app.status === 'rejected' ? (
                  <Text style={styles.rejectedTag}>{t('works.appStatus.rejected')}</Text>
                ) : (
                  <View style={styles.appActions}>
                    <Pressable style={styles.selectBtn} onPress={() => openSelect(app)} disabled={submitting}>
                      <Text style={styles.selectBtnText}>{t('works.select')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setRejectApp(app)} disabled={submitting}>
                      <Text style={styles.rejectLink}>{t('works.reject')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              );
            })}
          </ScrollView>
          <Pressable style={styles.modalCancel} onPress={() => setAppsWork(null)}>
            <Text style={styles.modalCancelText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </Dialog>

      {/* Select applicant — confirm the amount to freeze */}
      <Dialog visible={!!selectApp} onClose={() => setSelectApp(null)} maxWidth={maxWidth.dialogMd}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {t('works.selectAmountTitle')} · {selectApp?.fullName || selectApp?.username || '—'}
          </Text>
          <TextField
            label={t('works.selectAmountLabel')}
            value={selectAmount}
            onChangeText={setSelectAmount}
            format="decimal"
            keyboardType="decimal-pad"
            hint={t('works.selectAmountHint')}
          />
          <Text style={styles.selectFrozen}>
            {t('works.selectFrozen')}: {selectFrozen.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
            {selectPayment === 'tickets' && appsWork && appsWork.ticketPremiumPercent > 0
              ? ` (+${appsWork.ticketPremiumPercent}%)`
              : ''}
          </Text>
          {spendableBalance !== undefined && (
            <Text style={styles.selectAvail}>
              {t('works.treasuryAvailable')}: {spendableBalance.toLocaleString()} {currency}
            </Text>
          )}
          <PrimaryButton title={t('works.select')} onPress={confirmSelect} loading={submitting} />
          <Pressable style={styles.modalCancel} onPress={() => setSelectApp(null)}>
            <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Dialog>

      {/* Rating modal */}
      <Dialog visible={!!rateWork} onClose={() => setRateWork(null)} maxWidth={maxWidth.dialogMd}>
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
      </Dialog>

      {/* Reject application modal */}
      <Dialog visible={!!rejectApp} onClose={() => setRejectApp(null)} maxWidth={maxWidth.dialogMd}>
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
      </Dialog>

      {/* Applicant profile */}
      <InvestorProfileModal
        visible={!!profileUserId}
        investorId={profileUserId}
        excludeProjectId={projectId}
        onClose={() => setProfileUserId(null)}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    caption: { fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginBottom: spacing.md },
    treasuryRow: { flexDirection: 'row', marginBottom: spacing.md },
    treasuryCell: {
      flex: 1,
      backgroundColor: c.background,
      borderRadius: 10,
      padding: spacing.sm,
      marginHorizontal: 2,
      alignItems: 'center',
    },
    treasuryLabel: { fontSize: 11, color: c.textMuted, fontWeight: '600' },
    treasuryValue: { fontSize: 14, fontWeight: '700', color: c.text, marginTop: 2 },
    createButton: { marginBottom: spacing.md },
    empty: { textAlign: 'center', color: c.textMuted, paddingVertical: spacing.lg },
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: c.surface,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: c.text, marginRight: spacing.sm },
    statusChip: { borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    statusChipText: { fontSize: 11, fontWeight: '700' },
    cardBrief: { fontSize: 13, color: c.text, marginTop: 4 },
    cardPrice: { fontSize: 13, fontWeight: '700', color: c.primary, marginTop: 4 },
    cardMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    premiumNote: { fontSize: 12, color: c.success, fontWeight: '600', marginBottom: spacing.sm },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
    actionBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: c.primary },
    deleteLink: { fontSize: 12, fontWeight: '600', color: c.danger, marginLeft: spacing.sm },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    editLink: { fontSize: 12, fontWeight: '600', color: c.primary, marginLeft: spacing.sm },
    appliedBox: {
      marginTop: spacing.sm,
      backgroundColor: c.background,
      borderRadius: 8,
      padding: spacing.sm,
    },
    appliedText: { fontSize: 13, fontWeight: '600', color: c.text },
    appliedReason: { fontSize: 12, color: c.danger, marginTop: 2 },
    appActions: { flexDirection: 'row', alignItems: 'center' },
    rejectedTag: { fontSize: 11, fontWeight: '700', color: c.danger },
    rejectLink: { fontSize: 12, fontWeight: '600', color: c.danger, marginLeft: spacing.md },
    flex1: { flex: 1, marginRight: spacing.sm },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: spacing.lg,
      width: '100%',
      // Dialog caps the height; without this the card would keep its full content height
      // and spill past that cap instead of letting its ScrollView take over.
      flexShrink: 1,
      alignSelf: 'center',
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    pickerLabel: { fontSize: 14, color: c.textMuted, marginBottom: spacing.xs },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: 12, color: c.textMuted, fontWeight: '600' },
    chipTextActive: { color: c.textOnAccent },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    switchLabel: { flex: 1, fontSize: 14, color: c.text, marginRight: spacing.sm },
    modalCancel: { alignItems: 'center', paddingVertical: spacing.md },
    modalCancelText: { color: c.textMuted, fontWeight: '600', fontSize: 14 },
    appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border },
    appText: { flex: 1, marginRight: spacing.sm },
    appNameRow: { flexDirection: 'row', alignItems: 'center' },
    appNameText: { marginLeft: spacing.sm, flex: 1 },
    appName: { fontSize: 14, fontWeight: '600', color: c.text },
    viewProfileLink: { fontSize: 11, fontWeight: '600', color: c.primary, marginTop: 1 },
    appCover: { fontSize: 12, color: c.textMuted, marginTop: 4 },
    appPrice: { fontSize: 12, fontWeight: '700', color: c.primary, marginTop: 4 },
    applyPrice: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: spacing.md },
    contactsWarnBox: {
      backgroundColor: `${c.warning}22`,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    contactsWarnText: { fontSize: 12, color: c.text, lineHeight: 17 },
    contactsOkNote: { fontSize: 12, color: c.success, fontWeight: '600', marginBottom: spacing.md },
    paymentHint: { fontSize: 12, color: c.textMuted, marginBottom: spacing.sm, lineHeight: 16 },
    priceUp: { color: c.danger, fontWeight: '700' },
    priceDown: { color: c.success, fontWeight: '700' },
    selectFrozen: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
    selectAvail: { fontSize: 12, color: c.textMuted, marginBottom: spacing.md },
    selectBtn: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
    selectBtnText: { color: c.textOnAccent, fontWeight: '700', fontSize: 12 },
    selectedTag: { fontSize: 11, fontWeight: '700', color: c.warning },
    milestones: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.xs },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
    plannedStrike: { color: c.textMuted, textDecorationLine: 'line-through', fontWeight: '400' },
    milestoneTitle: { fontSize: 13, fontWeight: '600', color: c.text },
    milestoneMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    miniBtn: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 5 },
    miniBtnText: { color: c.textOnAccent, fontWeight: '700', fontSize: 11 },
    addRowText: { color: c.primary, fontWeight: '700', fontSize: 13, marginBottom: spacing.md },
    disputeLink: { fontSize: 12, fontWeight: '600', color: c.warning, marginTop: spacing.sm },
    rateBtn: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    rateBtnText: { color: c.primary, fontWeight: '700', fontSize: 12 },
    reviewBox: {
      marginTop: spacing.sm,
      backgroundColor: c.background,
      borderRadius: 8,
      padding: spacing.sm,
    },
    reviewStars: { fontSize: 16, color: c.warning, letterSpacing: 2 },
    reviewStarsEmpty: { color: c.border },
    reviewComment: { fontSize: 13, color: c.text, marginTop: 4 },
    starsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md },
    star: { fontSize: 34, color: c.border, marginHorizontal: 4 },
    starActive: { color: c.warning },
  });
