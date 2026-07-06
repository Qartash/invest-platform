import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { HintModal } from '../../components/HintModal';
import { RichTextEditor } from '../../components/RichTextEditor';
import { colors, spacing } from '../../theme';
import {
  addProjectBudgetItems,
  createProject,
  deleteProjectAttachment,
  fetchProject,
  fetchProjectAttachments,
  fetchProjectBudgetItems,
  setProjectPriority,
  updateProject,
  uploadCoverImage,
  uploadProjectAttachment,
} from '../../api/projects';
import { resolveMediaUrl } from '../../api/client';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n';
import { FounderStackParamList } from '../../navigation/FounderNavigator';
import { showAlert } from '../../utils/alert';
import { computeTicketPricingPreview, deriveBaseTicketPrice } from '../../utils/pricing';
import { isRichTextEmpty } from '../../utils/richText';
import { PRIORITY_LEVELS, ProjectPriority, PRIORITY_COLORS } from '../../utils/priority';
import { ProjectAttachment, ProjectBudgetItem } from '../../types';

// Raw DOM tags (not RN components) so we can render real HTML elements on web:
// a native date picker, a YouTube embed, and a file picker — none of which RN
// has a cross-platform primitive for.
const HtmlInput: any = 'input';
const HtmlIframe: any = 'iframe';

const MIN_PRICE_TIER_COUNT = 1;
const MAX_PRICE_TIER_COUNT = 10;

// Keep in sync with ALLOWED_ATTACHMENT_MIME_TYPES / MAX_ATTACHMENTS_PER_PROJECT in
// backend/src/projects/projects.controller.ts and projects.service.ts.
const MAX_ATTACHMENTS_PER_PROJECT = 10;
const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png';

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

function isValidFutureDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function extractYoutubeVideoId(url: string): string | null {
  const match = url
    .trim()
    .match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Plain DOM style object (not StyleSheet.create) since this styles a raw <input>
// element, not a React Native component.
const webDateInputStyle: any = {
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 16,
  backgroundColor: colors.surface,
  color: colors.text,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

const youtubeIframeStyle: any = {
  width: '100%',
  aspectRatio: '16 / 9',
  border: 'none',
  borderRadius: 10,
};

type Props = NativeStackScreenProps<FounderStackParamList, 'CreateProject'>;

export function CreateProjectScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const projectId = route.params?.projectId;
  const isEditing = !!projectId;

  const [activeLang, setActiveLang] = useState<SupportedLanguage>('hy');
  const [title, setTitle] = useState<Record<string, string>>({ hy: '', ru: '', en: '' });
  const [description, setDescription] = useState<Record<string, string>>({ hy: '', ru: '', en: '' });
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [changeReason, setChangeReason] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [totalTickets, setTotalTickets] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priceTierCount, setPriceTierCount] = useState('4');
  const [priceTierIncrementPercent, setPriceTierIncrementPercent] = useState('20');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [resaleEnabled, setResaleEnabled] = useState(false);
  const [expectedAnnualReturnPercent, setExpectedAnnualReturnPercent] = useState('20');
  const [payoutStartDays, setPayoutStartDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | undefined>(undefined);
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  // Set once a brand-new project has been created in this session, so its
  // attachments section can open immediately instead of forcing the founder to
  // wait out moderation before they're able to attach files at all.
  const [createdProjectId, setCreatedProjectId] = useState<string | undefined>(undefined);
  const attachmentsProjectId = projectId ?? createdProjectId;
  const canManageAttachments = isEditing || !!createdProjectId;
  // Files picked before the project exists yet (no id to upload against) — held
  // in memory like `pickedImage` and actually uploaded once handleSubmit gets an id.
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([]);
  const [existingBudgetItems, setExistingBudgetItems] = useState<ProjectBudgetItem[]>([]);
  const [budgetItems, setBudgetItems] = useState<{ title: string; amount: string }[]>([]);
  const [hint, setHint] = useState<{ title: string; description: string } | null>(null);
  const showHint = (title: string, description: string) => setHint({ title, description });
  // RichTextEditor only reads its initial `value` once, on mount (see its own
  // comment) so the cursor isn't reset on every keystroke. When editing an
  // existing project, the description text arrives asynchronously from
  // fetchProject — this flag forces one remount (via the editor's `key`) once
  // that data lands, so the loaded text actually shows up.
  const [dataLoaded, setDataLoaded] = useState(!projectId);

  useEffect(() => {
    if (!projectId) return;
    fetchProject(projectId).then((project) => {
      if (project.status === 'pending_review') {
        showAlert(t('founder.reviewPendingNotice'));
        navigation.goBack();
        return;
      }
      setTitle({ hy: '', ru: '', en: '', ...project.title });
      setDescription({ hy: '', ru: '', en: '', ...project.description });
      setCategory(project.category ?? '');
      setPriority(project.priority ?? 'medium');
      setTargetAmount(project.targetAmount);
      setTotalTickets(String(project.totalTickets));
      setDeadline(project.deadline ?? '');
      setPriceTierCount(String(project.priceTierCount));
      setPriceTierIncrementPercent(project.priceTierIncrementPercent ?? '20');
      setYoutubeUrl(project.youtubeUrl ?? '');
      setResaleEnabled(project.resaleEnabled);
      setExpectedAnnualReturnPercent(project.expectedAnnualReturnPercent);
      setPayoutStartDays(String(project.payoutStartDays));
      setExistingCoverUrl(project.coverImageUrl);
      setDataLoaded(true);
    });
    fetchProjectAttachments(projectId).then(setAttachments);
    fetchProjectBudgetItems(projectId).then(setExistingBudgetItems);
  }, [projectId]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPickedImage({
      uri: asset.uri,
      name: asset.fileName ?? 'cover.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const handleAttachmentFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    if (!attachmentsProjectId) {
      // Project doesn't exist yet — stage the files locally; they're uploaded
      // once handleSubmit creates the project and gets a real id.
      const remainingSlots = MAX_ATTACHMENTS_PER_PROJECT - pendingAttachmentFiles.length;
      setPendingAttachmentFiles((prev) => [...prev, ...files.slice(0, remainingSlots)]);
      return;
    }
    const remainingSlots = MAX_ATTACHMENTS_PER_PROJECT - attachments.length;
    const filesToUpload = files.slice(0, remainingSlots);
    setUploadingAttachment(true);
    try {
      for (const file of filesToUpload) {
        const attachment = await uploadProjectAttachment(attachmentsProjectId, file);
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAddBudgetItemRow = () => {
    setBudgetItems((prev) => [...prev, { title: '', amount: '' }]);
  };

  const handleUpdateBudgetItemRow = (index: number, field: 'title' | 'amount', value: string) => {
    setBudgetItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleRemoveBudgetItemRow = (index: number) => {
    setBudgetItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!attachmentsProjectId) return;
    try {
      await deleteProjectAttachment(attachmentsProjectId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    }
  };

  const targetAmountNum = parseFloat(targetAmount) || 0;
  const totalTicketsNum = parseInt(totalTickets, 10) || 0;
  const priceTierCountNum = parseInt(priceTierCount, 10) || 0;
  const priceTierIncrementPercentNum = parseFloat(priceTierIncrementPercent) || 0;
  const expectedAnnualReturnNum = parseFloat(expectedAnnualReturnPercent) || 0;
  const payoutStartDaysNum = payoutStartDays.trim() === '' ? 0 : parseInt(payoutStartDays, 10) || -1;

  // Ticket price is derived from the other numbers instead of typed in by hand,
  // so the funding goal, ticket price and ticket count can never drift apart.
  const ticketPriceNum = deriveBaseTicketPrice({
    targetAmount: targetAmountNum,
    totalTickets: totalTicketsNum,
    priceTierCount: priceTierCountNum || 4,
    incrementPercent: priceTierIncrementPercentNum,
  });

  const missingLanguages = SUPPORTED_LANGUAGES.filter(
    (lang) => isRichTextEmpty(title[lang] ?? '') || isRichTextEmpty(description[lang] ?? ''),
  );

  const youtubeVideoId = youtubeUrl.trim() ? extractYoutubeVideoId(youtubeUrl.trim()) : null;

  const errors = {
    languages:
      missingLanguages.length > 0
        ? t('founder.missingLanguagesError', { languages: missingLanguages.map((l) => l.toUpperCase()).join(', ') })
        : undefined,
    targetAmount: targetAmountNum <= 0 ? t('founder.requiredFieldError') : undefined,
    totalTickets: totalTicketsNum <= 0 ? t('founder.requiredFieldError') : undefined,
    deadline: deadline.trim() && !isValidFutureDateString(deadline.trim()) ? t('founder.deadlineInvalidError') : undefined,
    priceTierCount:
      priceTierCountNum < MIN_PRICE_TIER_COUNT || priceTierCountNum > MAX_PRICE_TIER_COUNT
        ? t('founder.priceTierCountRangeError', { min: MIN_PRICE_TIER_COUNT, max: MAX_PRICE_TIER_COUNT })
        : undefined,
    payoutStartDays: payoutStartDaysNum < 0 ? t('founder.requiredFieldError') : undefined,
    youtubeUrl: youtubeUrl.trim() && !youtubeVideoId ? t('founder.youtubeUrlInvalidError') : undefined,
  };

  const previewTiers = computeTicketPricingPreview({
    ticketPrice: ticketPriceNum,
    totalTickets: totalTicketsNum,
    priceTierCount: priceTierCountNum || 4,
    incrementPercent: priceTierIncrementPercentNum,
  });

  const canSubmit = Object.values(errors).every((e) => !e) && ticketPriceNum > 0;

  const handleSubmit = async () => {
    if (createdProjectId) {
      // Already created earlier in this session; the founder is just done
      // attaching files now.
      navigation.goBack();
      return;
    }
    setAttemptedSubmit(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const validNewBudgetItems = budgetItems
        .filter((item) => item.title.trim() && parseFloat(item.amount) > 0)
        .map((item) => ({ title: item.title.trim(), amount: parseFloat(item.amount) }));
      const data = {
        title: Object.fromEntries(Object.entries(title).filter(([, v]) => !isRichTextEmpty(v))),
        description: Object.fromEntries(Object.entries(description).filter(([, v]) => !isRichTextEmpty(v))),
        category: category.trim() || undefined,
        targetAmount: targetAmountNum,
        ticketPrice: ticketPriceNum,
        totalTickets: totalTicketsNum,
        deadline: deadline.trim() || undefined,
        priceTierCount: priceTierCountNum || 4,
        priceTierIncrementPercent: priceTierIncrementPercentNum || 20,
        youtubeUrl: youtubeUrl.trim() || undefined,
        resaleEnabled,
        expectedAnnualReturnPercent: expectedAnnualReturnNum || 20,
        payoutStartDays: payoutStartDaysNum >= 0 ? payoutStartDaysNum : 30,
        priority,
        changeReason: isEditing && !isRichTextEmpty(changeReason) ? changeReason.trim() : undefined,
        budgetItems: !isEditing ? validNewBudgetItems : undefined,
      };
      const savedProjectId = isEditing && projectId ? (await updateProject(projectId, data)).id : (await createProject(data)).id;
      // Priority isn't part of the reviewed diff — it's meta info for triage, so it
      // applies immediately via its own endpoint instead of waiting on moderation.
      if (isEditing && savedProjectId) {
        await setProjectPriority(savedProjectId, priority);
      }
      if (isEditing && validNewBudgetItems.length > 0) {
        await addProjectBudgetItems(savedProjectId, validNewBudgetItems);
      }
      if (pickedImage) {
        await uploadCoverImage(savedProjectId, pickedImage);
      }
      if (!isEditing && pendingAttachmentFiles.length > 0) {
        setUploadingAttachment(true);
        try {
          for (const file of pendingAttachmentFiles) {
            const attachment = await uploadProjectAttachment(savedProjectId, file);
            setAttachments((prev) => [...prev, attachment]);
          }
          setPendingAttachmentFiles([]);
        } finally {
          setUploadingAttachment(false);
        }
      }
      if (isEditing) {
        navigation.goBack();
      } else {
        // Stay on screen so the founder can attach more files or confirm the
        // ones just uploaded, without waiting for moderation to finish first.
        setCreatedProjectId(savedProjectId);
      }
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.message ?? undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const coverPreviewUri = pickedImage?.uri ?? (existingCoverUrl ? resolveMediaUrl(existingCoverUrl) : undefined);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.coverPicker} onPress={handlePickImage}>
        {coverPreviewUri ? (
          <Image source={{ uri: coverPreviewUri }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>{t('founder.addPhoto')}</Text>
          </View>
        )}
        <View style={styles.coverButton}>
          <Text style={styles.coverButtonText}>
            {coverPreviewUri ? t('founder.changePhoto') : t('founder.addPhoto')}
          </Text>
        </View>
      </Pressable>

      <View style={styles.langRow}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const filled = !isRichTextEmpty(title[lang] ?? '') && !isRichTextEmpty(description[lang] ?? '');
          return (
            <Pressable
              key={lang}
              style={[styles.langChip, activeLang === lang && styles.langChipActive]}
              onPress={() => setActiveLang(lang)}
            >
              <Text style={[styles.langChipText, activeLang === lang && styles.langChipTextActive]}>
                {lang.toUpperCase()}
              </Text>
              <View style={[styles.langChipDot, filled ? styles.langChipDotFilled : styles.langChipDotEmpty]} />
            </Pressable>
          );
        })}
      </View>

      <TextField
        label={`${t('founder.titleField')} (${activeLang})`}
        placeholder={t('founder.titlePlaceholder')}
        value={title[activeLang]}
        onChangeText={(v) => setTitle((prev) => ({ ...prev, [activeLang]: v }))}
        onHintPress={() => showHint(t('founder.titleField'), t('founder.titleFieldHint'))}
      />
      <View>
        <View style={styles.hintRow}>
          <Text style={styles.hintRowLabel}>{`${t('founder.descriptionField')} (${activeLang})`}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => showHint(t('founder.descriptionField'), t('founder.descriptionFieldHint'))}
            style={styles.hintIconButton}
          >
            <Text style={styles.hintIconText}>ⓘ</Text>
          </Pressable>
        </View>
        <RichTextEditor
          key={`${activeLang}-${dataLoaded}`}
          value={description[activeLang]}
          onChangeText={(v) => setDescription((prev) => ({ ...prev, [activeLang]: v }))}
          placeholder={t('founder.descriptionPlaceholder')}
        />
        {attemptedSubmit && errors.languages && <Text style={styles.dateFieldError}>{errors.languages}</Text>}
      </View>
      <TextField
        label={t('founder.categoryField')}
        placeholder={t('founder.categoryPlaceholder')}
        value={category}
        onChangeText={setCategory}
        onHintPress={() => showHint(t('founder.categoryField'), t('founder.categoryFieldHint'))}
      />

      <View style={styles.hintRow}>
        <Text style={styles.hintRowLabel}>{t('founder.priorityField')}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => showHint(t('founder.priorityField'), t('founder.priorityFieldHint'))}
          style={styles.hintIconButton}
        >
          <Text style={styles.hintIconText}>ⓘ</Text>
        </Pressable>
      </View>
      <View style={styles.priorityRow}>
        {PRIORITY_LEVELS.map((lvl) => (
          <Pressable
            key={lvl}
            style={[
              styles.priorityChip,
              { borderColor: PRIORITY_COLORS[lvl] },
              priority === lvl && { backgroundColor: PRIORITY_COLORS[lvl] },
            ]}
            onPress={() => setPriority(lvl)}
          >
            <Text style={[styles.priorityChipText, priority === lvl && styles.priorityChipTextActive]}>
              {t(`project.priority.${lvl}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {isEditing && (
        <View>
          <View style={styles.hintRow}>
            <Text style={styles.hintRowLabel}>{t('founder.changeReasonField')}</Text>
            <Pressable
              hitSlop={10}
              onPress={() => showHint(t('founder.changeReasonField'), t('founder.changeReasonHint'))}
              style={styles.hintIconButton}
            >
              <Text style={styles.hintIconText}>ⓘ</Text>
            </Pressable>
          </View>
          <RichTextEditor
            value={changeReason}
            onChangeText={setChangeReason}
            placeholder={t('founder.changeReasonPlaceholder')}
          />
        </View>
      )}

      {Platform.OS === 'web' ? (
        <View style={styles.dateFieldWrapper}>
          <View style={styles.hintRow}>
            <Text style={styles.hintRowLabel}>{t('founder.youtubeUrlField')}</Text>
            <Pressable
              hitSlop={10}
              onPress={() => showHint(t('founder.youtubeUrlField'), t('founder.youtubeUrlFieldHint'))}
              style={styles.hintIconButton}
            >
              <Text style={styles.hintIconText}>ⓘ</Text>
            </Pressable>
          </View>
          <HtmlInput
            type="url"
            value={youtubeUrl}
            placeholder={t('founder.youtubeUrlPlaceholder')}
            onChange={(e: any) => setYoutubeUrl(e.target.value)}
            style={webDateInputStyle}
          />
          {attemptedSubmit && errors.youtubeUrl && <Text style={styles.dateFieldError}>{errors.youtubeUrl}</Text>}
          {youtubeVideoId && (
            <View style={styles.youtubePreview}>
              <HtmlIframe
                src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                style={youtubeIframeStyle}
                allowFullScreen
              />
            </View>
          )}
        </View>
      ) : (
        <TextField
          label={t('founder.youtubeUrlField')}
          placeholder={t('founder.youtubeUrlPlaceholder')}
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          error={attemptedSubmit ? errors.youtubeUrl : undefined}
          onHintPress={() => showHint(t('founder.youtubeUrlField'), t('founder.youtubeUrlFieldHint'))}
        />
      )}

      {createdProjectId && (
        <Text style={styles.projectSubmittedNotice}>{t('founder.projectSubmittedNotice')}</Text>
      )}
      <View style={styles.tierPreview}>
        <View style={styles.hintRow}>
          <Text style={styles.tierPreviewTitle}>{t('founder.attachmentsTitle')}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => showHint(t('founder.attachmentsTitle'), t('founder.attachmentsHint'))}
            style={styles.hintIconButton}
          >
            <Text style={styles.hintIconText}>ⓘ</Text>
          </Pressable>
        </View>
        {Platform.OS !== 'web' ? (
          <Text style={styles.tierPreviewText}>{t('founder.attachmentsWebOnlyNotice')}</Text>
        ) : canManageAttachments ? (
          <>
            <Text style={styles.attachmentRules}>
              {t('founder.attachmentsRules', { count: MAX_ATTACHMENTS_PER_PROJECT })}
            </Text>
            {attachments.map((file) => (
              <View key={file.id} style={styles.attachmentRow}>
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {file.fileName}
                  </Text>
                  <Text style={styles.attachmentMeta}>{formatFileSize(file.fileSize)}</Text>
                </View>
                <Pressable onPress={() => handleDeleteAttachment(file.id)} hitSlop={8}>
                  <Text style={styles.attachmentRemove}>{t('common.close')}</Text>
                </Pressable>
              </View>
            ))}
            {attachments.length >= MAX_ATTACHMENTS_PER_PROJECT ? (
              <Text style={styles.tierPreviewText}>{t('founder.attachmentsLimitReached')}</Text>
            ) : (
              <HtmlInput
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                onChange={(e: any) => {
                  const files = Array.from(e.target.files ?? []) as File[];
                  if (files.length > 0) handleAttachmentFilesSelected(files);
                  e.target.value = '';
                }}
                style={{ marginTop: attachments.length > 0 ? 8 : 0 }}
              />
            )}
            {uploadingAttachment && <Text style={styles.tierPreviewText}>{t('common.loading')}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.attachmentRules}>
              {t('founder.attachmentsRules', { count: MAX_ATTACHMENTS_PER_PROJECT })}
            </Text>
            {pendingAttachmentFiles.map((file, index) => (
              <View key={`${file.name}-${index}`} style={styles.attachmentRow}>
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.attachmentMeta}>{formatFileSize(file.size)}</Text>
                </View>
                <Pressable onPress={() => handleRemovePendingAttachment(index)} hitSlop={8}>
                  <Text style={styles.attachmentRemove}>{t('common.close')}</Text>
                </Pressable>
              </View>
            ))}
            {pendingAttachmentFiles.length >= MAX_ATTACHMENTS_PER_PROJECT ? (
              <Text style={styles.tierPreviewText}>{t('founder.attachmentsLimitReached')}</Text>
            ) : (
              <HtmlInput
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                onChange={(e: any) => {
                  const files = Array.from(e.target.files ?? []) as File[];
                  if (files.length > 0) handleAttachmentFilesSelected(files);
                  e.target.value = '';
                }}
                style={{ marginTop: pendingAttachmentFiles.length > 0 ? 8 : 0 }}
              />
            )}
          </>
        )}
      </View>

      <TextField
        label={t('founder.targetAmount')}
        keyboardType="decimal-pad"
        format="decimal"
        placeholder={t('founder.targetAmountPlaceholder')}
        value={targetAmount}
        onChangeText={setTargetAmount}
        error={attemptedSubmit ? errors.targetAmount : undefined}
        onHintPress={() => showHint(t('founder.targetAmount'), t('founder.targetAmountHint'))}
      />

      <View style={styles.tierPreview}>
        <View style={styles.hintRow}>
          <Text style={styles.tierPreviewTitle}>{t('founder.budgetPlanTitle')}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => showHint(t('founder.budgetPlanTitle'), t('founder.budgetPlanHint'))}
            style={styles.hintIconButton}
          >
            <Text style={styles.hintIconText}>ⓘ</Text>
          </Pressable>
        </View>
        {existingBudgetItems.length > 0 && (
          <View style={styles.existingBudgetItems}>
            {existingBudgetItems.map((item) => (
              <View key={item.id} style={styles.existingBudgetItemRow}>
                <Text style={styles.existingBudgetItemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.existingBudgetItemAmount}>
                  {parseFloat(item.amount).toLocaleString()} {t('common.currency')}
                </Text>
              </View>
            ))}
          </View>
        )}
        {budgetItems.map((item, index) => (
          <View key={index} style={styles.budgetItemRow}>
            <View style={styles.attachmentRow}>
              <Text style={styles.hintRowLabel}>
                {t('founder.budgetItemTitle')} #{existingBudgetItems.length + index + 1}
              </Text>
              <Pressable onPress={() => handleRemoveBudgetItemRow(index)} hitSlop={8}>
                <Text style={styles.attachmentRemove}>{t('common.close')}</Text>
              </Pressable>
            </View>
            <TextField
              label={t('founder.budgetItemTitle')}
              placeholder={t('founder.budgetItemTitlePlaceholder')}
              value={item.title}
              onChangeText={(v) => handleUpdateBudgetItemRow(index, 'title', v)}
            />
            <TextField
              label={t('founder.budgetItemAmount')}
              keyboardType="decimal-pad"
              format="decimal"
              value={item.amount}
              onChangeText={(v) => handleUpdateBudgetItemRow(index, 'amount', v)}
            />
          </View>
        ))}
        <PrimaryButton title={t('founder.addBudgetItem')} variant="outline" onPress={handleAddBudgetItemRow} />
      </View>

      <TextField
        label={t('founder.totalTickets')}
        keyboardType="number-pad"
        format="integer"
        placeholder={t('founder.totalTicketsPlaceholder')}
        value={totalTickets}
        onChangeText={setTotalTickets}
        error={attemptedSubmit ? errors.totalTickets : undefined}
        onHintPress={() => showHint(t('founder.totalTickets'), t('founder.totalTicketsHint'))}
      />

      {Platform.OS === 'web' ? (
        <View style={styles.dateFieldWrapper}>
          <View style={styles.hintRow}>
            <Text style={styles.hintRowLabel}>{t('founder.deadline')}</Text>
            <Pressable
              hitSlop={10}
              onPress={() => showHint(t('founder.deadline'), t('founder.deadlineFieldHint'))}
              style={styles.hintIconButton}
            >
              <Text style={styles.hintIconText}>ⓘ</Text>
            </Pressable>
          </View>
          <HtmlInput
            type="date"
            value={deadline}
            min={tomorrowDateString()}
            onChange={(e: any) => setDeadline(e.target.value)}
            style={webDateInputStyle}
          />
          {attemptedSubmit && errors.deadline && <Text style={styles.dateFieldError}>{errors.deadline}</Text>}
        </View>
      ) : (
        <TextField
          label={t('founder.deadline')}
          placeholder="YYYY-MM-DD"
          hint={t('common.dateFormatHint')}
          format="date"
          value={deadline}
          onChangeText={setDeadline}
          error={attemptedSubmit ? errors.deadline : undefined}
          onHintPress={() => showHint(t('founder.deadline'), t('founder.deadlineFieldHint'))}
        />
      )}

      <TextField
        label={t('founder.priceTierCount')}
        keyboardType="number-pad"
        format="integer"
        placeholder="4"
        value={priceTierCount}
        onChangeText={setPriceTierCount}
        error={attemptedSubmit ? errors.priceTierCount : undefined}
        onHintPress={() => showHint(t('founder.priceTierCount'), t('founder.priceTierCountFieldHint'))}
      />
      <TextField
        label={t('founder.priceTierIncrementPercent')}
        keyboardType="decimal-pad"
        format="decimal"
        placeholder="20"
        value={priceTierIncrementPercent}
        onChangeText={setPriceTierIncrementPercent}
        onHintPress={() =>
          showHint(t('founder.priceTierIncrementPercent'), t('founder.priceTierIncrementPercentHint'))
        }
      />

      <View style={styles.tierPreview}>
        <View style={styles.hintRow}>
          <Text style={styles.tierPreviewTitle}>{t('project.ticketPrice')}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => showHint(t('project.ticketPrice'), t('founder.ticketPriceAutoHint'))}
            style={styles.hintIconButton}
          >
            <Text style={styles.hintIconText}>ⓘ</Text>
          </Pressable>
        </View>
        <Text style={styles.computedPriceValue}>
          {ticketPriceNum > 0
            ? `${ticketPriceNum.toLocaleString()} ${t('common.currency')}`
            : t('founder.ticketPriceNotAvailable')}
        </Text>
        {previewTiers.length > 0 && (
          <View style={styles.tierPreviewList}>
            <Text style={styles.tierPreviewSubtitle}>{t('founder.tierPreviewTitle')}</Text>
            {previewTiers.map((tier) => (
              <View key={tier.tier} style={styles.tierPreviewRow}>
                <Text style={styles.tierPreviewText}>
                  {t('project.roundLabel', { round: tier.tier + 1 })} ({tier.ticketsFrom}–{tier.ticketsTo}):{' '}
                  {tier.price.toLocaleString()} {t('common.currency')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <TextField
        label={t('founder.expectedAnnualReturn')}
        keyboardType="decimal-pad"
        format="decimal"
        placeholder="20"
        hint={t('founder.expectedAnnualReturnHint')}
        value={expectedAnnualReturnPercent}
        onChangeText={setExpectedAnnualReturnPercent}
        onHintPress={() => showHint(t('founder.expectedAnnualReturn'), t('founder.expectedAnnualReturnFieldHint'))}
      />
      <TextField
        label={t('founder.payoutStartDays')}
        keyboardType="number-pad"
        format="integer"
        placeholder="30"
        hint={t('founder.payoutStartDaysHint')}
        value={payoutStartDays}
        onChangeText={setPayoutStartDays}
        error={attemptedSubmit ? errors.payoutStartDays : undefined}
        onHintPress={() => showHint(t('founder.payoutStartDays'), t('founder.payoutStartDaysFieldHint'))}
      />

      <View style={styles.switchRow}>
        <View style={styles.switchLabelRow}>
          <Text style={styles.switchLabel}>{t('founder.resaleEnabled')}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => showHint(t('founder.resaleEnabled'), t('founder.resaleEnabledFieldHint'))}
            style={styles.switchHintButton}
          >
            <Text style={styles.switchHintIcon}>ⓘ</Text>
          </Pressable>
        </View>
        <Switch value={resaleEnabled} onValueChange={setResaleEnabled} />
      </View>

      {attemptedSubmit && !canSubmit && (
        <Text style={styles.formErrorSummary}>{t('founder.formHasErrorsNotice')}</Text>
      )}

      <PrimaryButton
        title={createdProjectId ? t('common.close') : isEditing ? t('common.save') : t('founder.submit')}
        onPress={handleSubmit}
        loading={submitting}
      />
      <HintModal hint={hint} onClose={() => setHint(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  coverPicker: {
    marginBottom: spacing.lg,
  },
  coverImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  coverPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  coverButton: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  coverButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  langRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  langChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: spacing.xs,
  },
  langChipDotFilled: {
    backgroundColor: colors.success,
  },
  langChipDotEmpty: {
    backgroundColor: colors.danger,
  },
  langChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langChipText: {
    color: colors.text,
    fontWeight: '600',
  },
  langChipTextActive: {
    color: '#fff',
  },
  priorityRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
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
    color: colors.text,
  },
  priorityChipTextActive: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  switchLabel: {
    fontSize: 15,
    color: colors.text,
  },
  switchHintButton: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  switchHintIcon: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '700',
  },
  tierPreview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tierPreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    flex: 1,
  },
  tierPreviewList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tierPreviewSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  tierPreviewRow: {
    paddingVertical: 2,
  },
  tierPreviewText: {
    fontSize: 13,
    color: colors.text,
  },
  computedPriceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  formErrorSummary: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  hintRowLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  hintIconButton: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  hintIconText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '700',
  },
  dateFieldWrapper: {
    marginBottom: spacing.md,
  },
  dateFieldError: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  youtubePreview: {
    marginTop: spacing.sm,
  },
  budgetItemRow: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  existingBudgetItems: {
    marginBottom: spacing.sm,
  },
  existingBudgetItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  existingBudgetItemTitle: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    marginRight: spacing.sm,
  },
  existingBudgetItemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attachmentInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  attachmentName: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  attachmentMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  attachmentRemove: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  attachmentRules: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  projectSubmittedNotice: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
});
