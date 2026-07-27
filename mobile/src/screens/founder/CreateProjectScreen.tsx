import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { HintModal } from '../../components/HintModal';
import { RichTextEditor } from '../../components/RichTextEditor';
import { PageContainer, SectionHeader, SegmentedTabs, StepRail, StepState } from '../../components/ui';
import { BudgetMeter } from './createProject/BudgetMeter';
import { EconomicsCard } from './createProject/EconomicsCard';
import { EquityCard } from './createProject/EquityCard';
import { ProjectPreview } from './createProject/ProjectPreview';
import { ChecklistRow, ReviewChecklist } from './createProject/ReviewChecklist';
import {
  maxWidth,
  radius,
  spacing,
  tabularNums,
  ThemeColors,
  typography,
  useBreakpoint,
  useTheme,
  useThemeStyles,
} from '../../theme';
import {
  addProjectBudgetItems,
  createProject,
  deleteProjectAttachment,
  fetchProject,
  fetchProjectAttachments,
  fetchProjectBudgetItems,
  fetchProjectTeam,
  setProjectPriority,
  setProjectTeam,
  uploadTeamPhoto,
  updateProject,
  updateProjectAsAdmin,
  uploadCoverImage,
  uploadProjectAttachment,
} from '../../api/projects';
import { resolveMediaUrl } from '../../api/client';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n';
import { FounderStackParamList } from '../../navigation/FounderNavigator';
import { useAuthStore } from '../../store/authStore';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { computeTicketPricingPreview, deriveBaseTicketPrice } from '../../utils/pricing';
import { isRichTextEmpty } from '../../utils/richText';
import { PRIORITY_LEVELS, ProjectPriority, priorityColors } from '../../utils/priority';
import { ProjectAttachment, ProjectBudgetItem, TeamMemberInput } from '../../types';

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

/**
 * The form used to be one ~20-field scroll in an order nobody chose: the moderation-triage
 * priority sat between the category and the video, documents came before the form had even
 * asked for a funding goal, and the ticket count landed *after* the team — three screens away
 * from the goal and the rounds it is bound to by one formula.
 *
 * It is now a wizard. Steps never block: a founder can fill them in any order, and the review
 * step is what gathers the problems and hands out jumps to them.
 */
const STEP_KEYS = ['about', 'funding', 'budget', 'team', 'media', 'review', 'preview'] as const;
const STEP = {
  about: 0,
  funding: 1,
  budget: 2,
  team: 3,
  media: 4,
  review: 5,
  preview: 6,
} as const;
const LAST_STEP = STEP_KEYS.length - 1;

interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

// One row of the team editor. `photoUrl` is what the server already stores; `localPhoto` is a
// pick that has not been uploaded yet — on a brand-new project there is no id to upload
// against until after the project itself is created.
interface TeamDraft {
  name: string;
  role: string;
  bio: string;
  photoUrl?: string;
  localPhoto?: PickedImage;
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
// element, not a React Native component. A function of the palette so the web date
// input follows the theme like everything else.
const webDateInput = (c: ThemeColors): any => ({
  border: `1px solid ${c.border}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 16,
  backgroundColor: c.surface,
  color: c.text,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
});

const youtubeIframeStyle: any = {
  width: '100%',
  aspectRatio: '16 / 9',
  border: 'none',
  borderRadius: 10,
};

type Props = NativeStackScreenProps<FounderStackParamList, 'CreateProject'>;

export function CreateProjectScreen({ route, navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const webDateInputStyle = useMemo(() => webDateInput(colors), [colors]);
  const PRIORITY_COLORS = useMemo(() => priorityColors(colors), [colors]);
  const { t } = useTranslation();
  const { isCompact } = useBreakpoint();
  const projectId = route.params?.projectId;
  const isEditing = !!projectId;
  const isAdminEdit = !!route.params?.adminEdit;
  const authUser = useAuthStore((state) => state.user);
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);
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
  const [equityOfferedPercent, setEquityOfferedPercent] = useState('');
  // Mirrors the guard in backend projects.service.ts update(): once tickets are sold the
  // founder can't redraw the share they were sold. A moderator still can, so admin edits
  // never lock the field.
  const [equityLocked, setEquityLocked] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [resaleEnabled, setResaleEnabled] = useState(false);
  const [expectedAnnualReturnPercent, setExpectedAnnualReturnPercent] = useState('20');
  const [payoutStartDays, setPayoutStartDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | undefined>(undefined);
  // What the project has actually raised, so the step-7 preview shows the project as
  // it is rather than as a fresh draft. Stays null for a brand-new one, where the
  // zero state is the truth.
  const [liveState, setLiveState] = useState<{
    collectedAmount: number;
    ticketsSold: number;
    currentTier: number;
    status: string;
  } | null>(null);
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
  const [teamMembers, setTeamMembers] = useState<TeamDraft[]>([]);
  const [founderName, setFounderName] = useState<string | undefined>(undefined);
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
      // A live project with an edit awaiting a decision keeps its own status now,
      // so "already under review" has to be read off pendingChanges as well —
      // otherwise the founder can open the form and queue a second edit on top of
      // the first, which the backend then refuses on save.
      if ((project.status === 'pending_review' || project.pendingChanges) && !isAdminEdit) {
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
      setEquityOfferedPercent(project.equityOfferedPercent ?? '100');
      setEquityLocked(project.ticketsSold > 0 && !isAdminEdit);
      setYoutubeUrl(project.youtubeUrl ?? '');
      setResaleEnabled(project.resaleEnabled);
      setExpectedAnnualReturnPercent(project.expectedAnnualReturnPercent);
      setPayoutStartDays(String(project.payoutStartDays));
      setExistingCoverUrl(project.coverImageUrl);
      setLiveState({
        collectedAmount: parseFloat(project.collectedAmount),
        ticketsSold: project.ticketsSold,
        currentTier: project.pricing?.currentTier ?? 0,
        status: project.status,
      });
      setFounderName(project.founderName);
      setDataLoaded(true);
    });
    fetchProjectAttachments(projectId).then(setAttachments);
    fetchProjectBudgetItems(projectId).then(setExistingBudgetItems);
    fetchProjectTeam(projectId).then((members) =>
      setTeamMembers(
        members.map((member) => ({
          name: member.name,
          role: member.role,
          bio: member.bio ?? '',
          photoUrl: member.photoUrl ?? undefined,
        })),
      ),
    );
  }, [projectId]);

  /**
   * Steps never gate each other, so this is plain navigation. The one side effect: arriving at
   * the review step is the founder declaring themselves finished, which is the moment blanks
   * they haven't filled turn into mistakes worth painting red.
   */
  const goToStep = (next: number) => {
    if (next >= STEP.review) setAttemptedSubmit(true);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

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
      showAlert(t('common.error'), apiErrorMessage(err, t));
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

  const handleAddTeamMember = () => {
    setTeamMembers((prev) => [...prev, { name: '', role: '', bio: '' }]);
  };

  const handleUpdateTeamMember = (index: number, field: 'name' | 'role' | 'bio', value: string) => {
    setTeamMembers((prev) => prev.map((member, i) => (i === index ? { ...member, [field]: value } : member)));
  };

  const handleRemoveTeamMember = (index: number) => {
    showAlert(t('founder.teamRemove'), t('founder.teamRemoveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('founder.teamRemove'),
        style: 'destructive',
        onPress: () => setTeamMembers((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  };

  // Order is what the roster means — whoever is listed first reads as who leads the project.
  const handleMoveTeamMember = (index: number, delta: -1 | 1) => {
    setTeamMembers((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handlePickTeamPhoto = async (index: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    // Held locally and uploaded in handleSubmit — a new project has no id to upload against.
    setTeamMembers((prev) =>
      prev.map((member, i) =>
        i === index
          ? {
              ...member,
              localPhoto: {
                uri: asset.uri,
                name: asset.fileName ?? 'member.jpg',
                type: asset.mimeType ?? 'image/jpeg',
              },
            }
          : member,
      ),
    );
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
      showAlert(t('common.error'), apiErrorMessage(err, t));
    }
  };

  const targetAmountNum = parseFloat(targetAmount) || 0;
  const totalTicketsNum = parseInt(totalTickets, 10) || 0;
  const priceTierCountNum = parseInt(priceTierCount, 10) || 0;
  const priceTierIncrementPercentNum = parseFloat(priceTierIncrementPercent) || 0;
  const equityOfferedNum = parseFloat(equityOfferedPercent) || 0;
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
    equityOfferedPercent:
      equityOfferedNum <= 0 || equityOfferedNum > 100 ? t('founder.equityOfferedRangeError') : undefined,
    youtubeUrl: youtubeUrl.trim() && !youtubeVideoId ? t('founder.youtubeUrlInvalidError') : undefined,
  };

  const previewTiers = computeTicketPricingPreview({
    ticketPrice: ticketPriceNum,
    totalTickets: totalTicketsNum,
    priceTierCount: priceTierCountNum || 4,
    incrementPercent: priceTierIncrementPercentNum,
    targetAmount: targetAmountNum,
  });

  const canSubmit = Object.values(errors).every((e) => !e) && ticketPriceNum > 0;

  const currency = t('common.currency');
  const validNewBudgetItems = budgetItems
    .filter((item) => item.title.trim() && parseFloat(item.amount) > 0)
    .map((item) => ({ title: item.title.trim(), amount: parseFloat(item.amount) }));
  const budgetAllocated =
    existingBudgetItems.reduce((sum, item) => sum + parseFloat(item.amount), 0) +
    validNewBudgetItems.reduce((sum, item) => sum + item.amount, 0);
  const budgetItemCount = existingBudgetItems.length + validNewBudgetItems.length;
  const filledTeamCount = teamMembers.filter((m) => m.name.trim() && m.role.trim()).length;
  const incompleteTeamCount = teamMembers.length - filledTeamCount;
  const documentCount = canManageAttachments ? attachments.length : pendingAttachmentFiles.length;

  const aboutOk = missingLanguages.length === 0;
  const fundingOk =
    !errors.targetAmount && !errors.totalTickets && !errors.priceTierCount && !errors.deadline &&
    !errors.payoutStartDays && !errors.equityOfferedPercent && ticketPriceNum > 0;
  const mediaOk = !errors.youtubeUrl;

  /**
   * Optional steps (budget, team, materials) are never 'error' — leaving them empty is a
   * legitimate choice, so they only ever report 'done' or 'todo'.
   */
  const stepState = (index: number): StepState => {
    const ok = (done: boolean, required: boolean) =>
      done ? 'done' : required && attemptedSubmit ? 'error' : 'todo';
    switch (index) {
      case STEP.about:
        return ok(aboutOk, true);
      case STEP.funding:
        return ok(fundingOk, true);
      case STEP.budget:
        return ok(budgetItemCount > 0, false);
      case STEP.team:
        return ok(filledTeamCount > 0, false);
      case STEP.media:
        return ok(mediaOk && (documentCount > 0 || !!youtubeVideoId), !mediaOk);
      default:
        return ok(canSubmit, true);
    }
  };

  const checklistRows: ChecklistRow[] = [
    {
      step: STEP.about,
      title: t('founder.wizard.aboutName'),
      ok: aboutOk,
      subtitle: aboutOk ? t('founder.wizard.sumAboutOk') : (errors.languages as string),
    },
    {
      step: STEP.funding,
      title: t('founder.wizard.fundingName'),
      ok: fundingOk,
      subtitle: fundingOk
        ? t('founder.wizard.sumFundingOk', {
            amount: targetAmountNum.toLocaleString(),
            currency,
            tickets: totalTicketsNum,
            rounds: priceTierCountNum,
            equity: equityOfferedNum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
          })
        : t('founder.wizard.sumFundingBad'),
    },
    {
      step: STEP.budget,
      title: t('founder.wizard.budgetName'),
      ok: true,
      subtitle:
        budgetItemCount > 0
          ? t('founder.wizard.sumBudgetOk', {
              count: budgetItemCount,
              percent: targetAmountNum > 0 ? Math.round((budgetAllocated / targetAmountNum) * 100) : 0,
            })
          : t('founder.wizard.sumBudgetEmpty'),
    },
    {
      step: STEP.team,
      title: t('founder.wizard.teamName'),
      ok: true,
      subtitle:
        teamMembers.length === 0
          ? t('founder.wizard.sumTeamEmpty')
          : incompleteTeamCount > 0
            ? t('founder.wizard.sumTeamIncomplete', { filled: filledTeamCount, empty: incompleteTeamCount })
            : t('founder.wizard.sumTeamOk', { count: filledTeamCount }),
    },
    {
      step: STEP.media,
      title: t('founder.wizard.mediaName'),
      ok: mediaOk,
      subtitle: !mediaOk
        ? (errors.youtubeUrl as string)
        : documentCount > 0
          ? t('founder.wizard.sumMediaOk', { count: documentCount })
          : t('founder.wizard.sumMediaEmpty'),
    },
  ];

  /**
   * Uploads any freshly picked photos, then saves the roster whole.
   *
   * Rows missing a name or a role are dropped rather than rejected: an empty row the founder
   * added and never filled in shouldn't block the whole project from saving. The editor warns
   * about them inline instead.
   */
  const saveTeam = async (savedProjectId: string) => {
    const filled = teamMembers.filter((member) => member.name.trim() && member.role.trim());
    const members: TeamMemberInput[] = [];
    for (const member of filled) {
      const photoUrl = member.localPhoto
        ? await uploadTeamPhoto(savedProjectId, member.localPhoto)
        : member.photoUrl;
      members.push({
        name: member.name.trim(),
        role: member.role.trim(),
        bio: member.bio.trim() || undefined,
        photoUrl,
      });
    }
    await setProjectTeam(savedProjectId, members);
  };

  const handleSubmit = async () => {
    if (createdProjectId) {
      // Already created earlier in this session; the founder is just done attaching files
      // now. The roster stays editable in this state though, so persist it on the way out
      // instead of dropping whatever they added after the project was created.
      setSubmitting(true);
      try {
        await saveTeam(createdProjectId);
      } catch (err: any) {
        showAlert(t('common.error'), apiErrorMessage(err, t));
        return;
      } finally {
        setSubmitting(false);
      }
      navigation.goBack();
      return;
    }
    setAttemptedSubmit(true);
    if (!canSubmit) {
      // Don't just refuse — the review step is the screen that can actually say what's wrong
      // and hand out a jump to each problem.
      goToStep(STEP.review);
      return;
    }
    setSubmitting(true);
    try {
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
        equityOfferedPercent: equityOfferedNum,
        youtubeUrl: youtubeUrl.trim() || undefined,
        resaleEnabled,
        expectedAnnualReturnPercent: expectedAnnualReturnNum || 20,
        payoutStartDays: payoutStartDaysNum >= 0 ? payoutStartDaysNum : 30,
        priority,
        changeReason: isEditing && !isAdminEdit && !isRichTextEmpty(changeReason) ? changeReason.trim() : undefined,
        budgetItems: !isEditing ? validNewBudgetItems : undefined,
      };
      const savedProjectId =
        isEditing && projectId
          ? (await (isAdminEdit ? updateProjectAsAdmin(projectId, data) : updateProject(projectId, data))).id
          : (await createProject(data)).id;
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
      // The roster goes through its own endpoint rather than the moderated diff, matching how
      // budget items and priority already behave. Photos upload first so their URLs can ride
      // along in the same save.
      await saveTeam(savedProjectId);
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
        // Stay on screen so the founder can attach more files or confirm the ones just
        // uploaded, without waiting for moderation to finish first. The materials step is
        // the only thing left worth doing here, so land them on it.
        setCreatedProjectId(savedProjectId);
        goToStep(STEP.media);
      }
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimaryPress = () => {
    if (createdProjectId) return handleSubmit();
    if (step < LAST_STEP) return goToStep(step + 1);
    return handleSubmit();
  };

  const primaryLabel = createdProjectId
    ? t('common.close')
    : step < LAST_STEP
      ? t('founder.wizard.next')
      : isEditing
        ? t('common.save')
        : t('founder.submit');

  const coverPreviewUri = pickedImage?.uri ?? (existingCoverUrl ? resolveMediaUrl(existingCoverUrl) : undefined);

  const renderAttachmentPicker = (marginTop: number) => (
    <HtmlInput
      type="file"
      accept={ATTACHMENT_ACCEPT}
      multiple
      onChange={(e: any) => {
        const files = Array.from(e.target.files ?? []) as File[];
        if (files.length > 0) handleAttachmentFilesSelected(files);
        e.target.value = '';
      }}
      style={{ marginTop }}
    />
  );

  const renderStep = () => {
    switch (step) {
      // ─── About ──────────────────────────────────────────────────────────────
      case STEP.about:
        return (
          <>
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
              <SegmentedTabs
                active={activeLang}
                onChange={setActiveLang}
                tabs={SUPPORTED_LANGUAGES.map((lang) => ({
                  key: lang,
                  label: LANGUAGE_LABELS[lang],
                  // Red only once they've tried to submit — every other error on this screen waits
                  // for `attemptedSubmit`, and a blank form greeting the founder with three red
                  // dots reads as three mistakes they haven't had the chance to make yet.
                  dot: !isRichTextEmpty(title[lang] ?? '') && !isRichTextEmpty(description[lang] ?? '')
                    ? 'done'
                    : attemptedSubmit
                      ? 'missing'
                      : 'todo',
                }))}
              />
            </View>

            <TextField
              label={`${t('founder.titleField')} · ${LANGUAGE_LABELS[activeLang]}`}
              placeholder={t('founder.titlePlaceholder')}
              value={title[activeLang]}
              onChangeText={(v) => setTitle((prev) => ({ ...prev, [activeLang]: v }))}
              onHintPress={() => showHint(t('founder.titleField'), t('founder.titleFieldHint'))}
            />
            <View style={styles.fieldBlock}>
              <View style={styles.hintRow}>
                <Text style={styles.hintRowLabel}>{`${t('founder.descriptionField')} · ${LANGUAGE_LABELS[activeLang]}`}</Text>
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
              {attemptedSubmit && errors.languages && <Text style={styles.fieldError}>{errors.languages}</Text>}
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
          </>
        );

      // ─── Funding ────────────────────────────────────────────────────────────
      case STEP.funding:
        return (
          <>
            <SectionHeader title={t('founder.wizard.groupRaise')} />
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
              <View style={styles.fieldBlock}>
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
                {attemptedSubmit && errors.deadline && <Text style={styles.fieldError}>{errors.deadline}</Text>}
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

            <SectionHeader title={t('founder.wizard.groupEquity')} spaced />
            <TextField
              label={t('founder.equityOfferedPercent')}
              keyboardType="decimal-pad"
              format="decimal"
              placeholder="49"
              hint={equityLocked ? t('founder.equityOfferedLockedHint') : t('founder.equityOfferedHint')}
              editable={!equityLocked}
              value={equityOfferedPercent}
              onChangeText={setEquityOfferedPercent}
              error={attemptedSubmit ? errors.equityOfferedPercent : undefined}
              onHintPress={() => showHint(t('founder.equityOfferedPercent'), t('founder.equityOfferedFieldHint'))}
            />
            <EquityCard
              equityOfferedPercent={equityOfferedNum}
              targetAmount={targetAmountNum}
              totalTickets={totalTicketsNum}
              onHintPress={() => showHint(t('founder.wizard.impliedValuation'), t('founder.impliedValuationHint'))}
            />

            <SectionHeader title={t('founder.wizard.groupRounds')} spaced />
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

            {/* The one output on the step, directly under the four inputs it is derived from. */}
            <EconomicsCard
              ticketPrice={ticketPriceNum}
              tiers={previewTiers}
              onHintPress={() => showHint(t('project.ticketPrice'), t('founder.ticketPriceAutoHint'))}
            />

            <SectionHeader title={t('founder.wizard.groupReturn')} spaced />
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
          </>
        );

      // ─── Budget ─────────────────────────────────────────────────────────────
      case STEP.budget:
        return (
          <>
            <BudgetMeter allocated={budgetAllocated} target={targetAmountNum} />

            <View style={styles.hintRow}>
              <Text style={styles.hintRowLabel}>{t('founder.budgetPlanTitle')}</Text>
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
                      {parseFloat(item.amount).toLocaleString()} {currency}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {budgetItems.map((item, index) => (
              <View key={index} style={styles.budgetItemRow}>
                <View style={styles.rowHeader}>
                  <Text style={styles.hintRowLabel}>
                    {t('founder.budgetItemTitle')} #{existingBudgetItems.length + index + 1}
                  </Text>
                  <Pressable onPress={() => handleRemoveBudgetItemRow(index)} hitSlop={8}>
                    <Text style={styles.removeText}>{t('common.close')}</Text>
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
          </>
        );

      // ─── Team ───────────────────────────────────────────────────────────────
      case STEP.team:
        return (
          <>
            <Text style={styles.teamSectionHint}>{t('founder.teamHint')}</Text>

            {teamMembers.map((member, index) => {
              const photoUri = member.localPhoto?.uri ?? (member.photoUrl ? resolveMediaUrl(member.photoUrl) : undefined);
              const incomplete = !member.name.trim() || !member.role.trim();
              return (
                <View key={index} style={styles.teamRow}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.hintRowLabel}>#{index + 1}</Text>
                    <View style={styles.teamRowActions}>
                      <Pressable
                        onPress={() => handleMoveTeamMember(index, -1)}
                        disabled={index === 0}
                        hitSlop={8}
                        accessibilityLabel={t('founder.teamMoveUp')}
                      >
                        <Text style={[styles.teamMoveIcon, index === 0 && styles.teamMoveIconDisabled]}>↑</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleMoveTeamMember(index, 1)}
                        disabled={index === teamMembers.length - 1}
                        hitSlop={8}
                        accessibilityLabel={t('founder.teamMoveDown')}
                      >
                        <Text
                          style={[
                            styles.teamMoveIcon,
                            index === teamMembers.length - 1 && styles.teamMoveIconDisabled,
                          ]}
                        >
                          ↓
                        </Text>
                      </Pressable>
                      <Pressable onPress={() => handleRemoveTeamMember(index)} hitSlop={8}>
                        <Text style={styles.removeText}>{t('common.delete')}</Text>
                      </Pressable>
                    </View>
                  </View>

                  <Pressable style={styles.teamPhotoRow} onPress={() => handlePickTeamPhoto(index)}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.teamPhoto} />
                    ) : (
                      <View style={[styles.teamPhoto, styles.teamPhotoEmpty]}>
                        <Text style={styles.teamPhotoEmptyIcon}>＋</Text>
                      </View>
                    )}
                    <Text style={styles.teamPhotoAction}>
                      {photoUri ? t('founder.teamChangePhoto') : t('founder.teamAddPhoto')}
                    </Text>
                  </Pressable>

                  <TextField
                    label={t('founder.teamName')}
                    placeholder={t('founder.teamNamePlaceholder')}
                    value={member.name}
                    onChangeText={(v) => handleUpdateTeamMember(index, 'name', v)}
                  />
                  <TextField
                    label={t('founder.teamRole')}
                    placeholder={t('founder.teamRolePlaceholder')}
                    value={member.role}
                    onChangeText={(v) => handleUpdateTeamMember(index, 'role', v)}
                  />
                  <TextField
                    label={t('founder.teamBio')}
                    placeholder={t('founder.teamBioPlaceholder')}
                    value={member.bio}
                    multiline
                    onChangeText={(v) => handleUpdateTeamMember(index, 'bio', v)}
                  />
                  {incomplete && <Text style={styles.teamIncomplete}>{t('founder.teamMemberIncomplete')}</Text>}
                </View>
              );
            })}

            <PrimaryButton title={t('founder.teamAdd')} variant="outline" onPress={handleAddTeamMember} />
          </>
        );

      // ─── Materials ──────────────────────────────────────────────────────────
      case STEP.media:
        return (
          <>
            {createdProjectId && <Text style={styles.projectSubmittedNotice}>{t('founder.projectSubmittedNotice')}</Text>}

            {Platform.OS === 'web' ? (
              <View style={styles.fieldBlock}>
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
                {attemptedSubmit && errors.youtubeUrl && <Text style={styles.fieldError}>{errors.youtubeUrl}</Text>}
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

            <View style={styles.panel}>
              <View style={styles.hintRow}>
                <Text style={styles.panelTitle}>{t('founder.attachmentsTitle')}</Text>
                <Pressable
                  hitSlop={10}
                  onPress={() => showHint(t('founder.attachmentsTitle'), t('founder.attachmentsHint'))}
                  style={styles.hintIconButton}
                >
                  <Text style={styles.hintIconText}>ⓘ</Text>
                </Pressable>
              </View>

              {Platform.OS !== 'web' ? (
                <Text style={styles.panelText}>{t('founder.attachmentsWebOnlyNotice')}</Text>
              ) : (
                <>
                  <Text style={styles.attachmentRules}>
                    {t('founder.attachmentsRules', { count: MAX_ATTACHMENTS_PER_PROJECT })}
                  </Text>
                  {canManageAttachments
                    ? attachments.map((file) => (
                        <View key={file.id} style={styles.attachmentRow}>
                          <View style={styles.attachmentInfo}>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {file.fileName}
                            </Text>
                            <Text style={styles.attachmentMeta}>{formatFileSize(file.fileSize)}</Text>
                          </View>
                          <Pressable onPress={() => handleDeleteAttachment(file.id)} hitSlop={8}>
                            <Text style={styles.removeText}>{t('common.close')}</Text>
                          </Pressable>
                        </View>
                      ))
                    : pendingAttachmentFiles.map((file, index) => (
                        <View key={`${file.name}-${index}`} style={styles.attachmentRow}>
                          <View style={styles.attachmentInfo}>
                            <Text style={styles.attachmentName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.attachmentMeta}>{formatFileSize(file.size)}</Text>
                          </View>
                          <Pressable onPress={() => handleRemovePendingAttachment(index)} hitSlop={8}>
                            <Text style={styles.removeText}>{t('common.close')}</Text>
                          </Pressable>
                        </View>
                      ))}
                  {documentCount >= MAX_ATTACHMENTS_PER_PROJECT ? (
                    <Text style={styles.panelText}>{t('founder.attachmentsLimitReached')}</Text>
                  ) : (
                    renderAttachmentPicker(documentCount > 0 ? 8 : 0)
                  )}
                  {uploadingAttachment && <Text style={styles.panelText}>{t('common.loading')}</Text>}
                </>
              )}
            </View>
          </>
        );

      // ─── Review ─────────────────────────────────────────────────────────────
      case STEP.review:
        return (
          <>
            <View style={styles.panel}>
              <ReviewChecklist rows={checklistRows} onJump={goToStep} />
            </View>
            <Text style={styles.noticeInfo}>{t('founder.wizard.reviewNotice')}</Text>

            {isEditing && !isAdminEdit && (
              <View style={styles.fieldBlock}>
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
          </>
        );

      // ─── Preview ────────────────────────────────────────────────────────────
      default:
        return (
          <>
            <ProjectPreview
              coverUri={coverPreviewUri}
              title={title[activeLang] ?? ''}
              description={description[activeLang] ?? ''}
              founderName={founderName ?? authUser?.fullName ?? authUser?.username}
              target={targetAmountNum}
              ticketPrice={ticketPriceNum}
              totalTickets={totalTicketsNum}
              totalTiers={previewTiers.length || 1}
              collectedAmount={liveState?.collectedAmount}
              ticketsSold={liveState?.ticketsSold}
              currentTier={liveState?.currentTier}
              status={liveState?.status}
            />
            <View style={styles.previewFooter}>
              <Text style={styles.noticeWarn}>{t('founder.wizard.previewNotice')}</Text>
            </View>
          </>
        );
    }
  };

  return (
    <View style={styles.root}>
      {/* The wizard is four stacked bands, two of which paint a full-width surface. The
          bars keep spanning the window — a rail that stopped mid-screen would read as a
          card — and it is their contents that get capped, so all four line up. */}
      <View style={styles.railWrap}>
        <PageContainer maxWidth={maxWidth.column}>
          <StepRail
            states={STEP_KEYS.map((_, index) => stepState(index))}
            active={step}
            onSelect={goToStep}
            labels={STEP_KEYS.map((key) => t(`founder.wizard.${key}Name`))}
          />
        </PageContainer>
      </View>

      <PageContainer maxWidth={maxWidth.column}>
        <View style={styles.stepHead}>
          <View style={styles.stepHeadRow}>
            <Text style={styles.stepName}>{t(`founder.wizard.${STEP_KEYS[step]}Name`)}</Text>
            <Text style={styles.stepCount}>
              {t('founder.wizard.stepOf', { current: step + 1, total: STEP_KEYS.length })}
            </Text>
          </View>
          <Text style={styles.stepHint}>{t(`founder.wizard.${STEP_KEYS[step]}Hint`)}</Text>
        </View>
      </PageContainer>

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          !isCompact && styles.contentWide,
          step === STEP.preview && styles.contentBleed,
        ]}
      >
        {renderStep()}
      </ScrollView>

      <View style={[styles.foot, !isCompact && styles.footWide]}>
        <PageContainer maxWidth={maxWidth.column} style={styles.footRow}>
          {step > 0 && (
            <View style={styles.footBack}>
              <PrimaryButton title={t('founder.wizard.back')} variant="outline" onPress={() => goToStep(step - 1)} />
            </View>
          )}
          <View style={styles.footPrimary}>
            <PrimaryButton title={primaryLabel} onPress={handlePrimaryPress} loading={submitting} />
          </View>
        </PageContainer>
      </View>

      <HintModal hint={hint} onClose={() => setHint(null)} />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      paddingTop: spacing.md,
    },
    contentWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },
    // The preview step is the project page, not a picture of it — so it runs edge to edge
    // and its own footer note re-applies the horizontal padding. Listed after `contentWide`
    // so it still wins the padding on a wide window; the cap is what it bleeds to there.
    contentBleed: {
      paddingHorizontal: 0,
      paddingTop: 0,
    },
    railWrap: {
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm + 4,
      paddingBottom: spacing.sm + 4,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    stepHead: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    stepHeadRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    stepName: {
      ...typography.title,
      color: c.text,
    },
    stepCount: {
      ...typography.microStrong,
      ...tabularNums,
      color: c.textMuted,
    },
    stepHint: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.xs,
      lineHeight: 19,
    },
    foot: {
      flexDirection: 'row',
      gap: spacing.sm + 2,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
    },
    // `foot` is itself a row, so its cross axis is vertical and `alignSelf` on the capped
    // child would centre it the wrong way. Centring has to come from the main axis here.
    footWide: {
      justifyContent: 'center',
    },
    footRow: {
      flexDirection: 'row',
      gap: spacing.sm + 2,
    },
    footBack: {
      width: 110,
    },
    footPrimary: {
      flex: 1,
    },
    coverPicker: {
      marginBottom: spacing.lg,
    },
    coverImage: {
      width: '100%',
      height: 160,
      borderRadius: radius.lg,
      backgroundColor: c.border,
    },
    coverPlaceholder: {
      width: '100%',
      height: 160,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverPlaceholderText: {
      ...typography.bodyStrong,
      color: c.textMuted,
    },
    coverButton: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    coverButtonText: {
      ...typography.captionStrong,
      color: c.primary,
    },
    langRow: {
      marginBottom: spacing.md,
    },
    fieldBlock: {
      marginBottom: spacing.md,
    },
    priorityRow: {
      flexDirection: 'row',
      gap: spacing.xs + 2,
      marginBottom: spacing.md,
    },
    priorityChip: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    priorityChipText: {
      ...typography.captionStrong,
      color: c.text,
    },
    priorityChipTextActive: {
      color: c.textOnAccent,
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
      ...typography.body,
      color: c.text,
    },
    switchHintButton: {
      marginLeft: spacing.xs,
      padding: 2,
    },
    switchHintIcon: {
      ...typography.micro,
      fontWeight: '700',
      color: c.textMuted,
    },
    // Bordered well for content that isn't a plain field — the checklist, the attachment list.
    panel: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    panelTitle: {
      ...typography.captionStrong,
      color: c.textMuted,
      flex: 1,
    },
    panelText: {
      ...typography.caption,
      color: c.text,
    },
    noticeInfo: {
      ...typography.micro,
      color: c.text,
      backgroundColor: c.primarySoft,
      borderRadius: radius.md,
      padding: spacing.sm + 4,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    noticeWarn: {
      ...typography.micro,
      color: c.text,
      backgroundColor: c.warningSoft,
      borderRadius: radius.md,
      padding: spacing.sm + 4,
      lineHeight: 18,
    },
    previewFooter: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    hintRowLabel: {
      ...typography.label,
      color: c.textMuted,
    },
    hintIconButton: {
      marginLeft: spacing.xs,
      padding: 2,
    },
    hintIconText: {
      ...typography.micro,
      fontWeight: '700',
      color: c.textMuted,
    },
    fieldError: {
      ...typography.micro,
      color: c.danger,
      marginTop: spacing.xs,
    },
    youtubePreview: {
      marginTop: spacing.sm,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    removeText: {
      ...typography.microStrong,
      color: c.danger,
    },
    budgetItemRow: {
      marginBottom: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    existingBudgetItems: {
      marginBottom: spacing.sm,
    },
    existingBudgetItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    existingBudgetItemTitle: {
      flex: 1,
      ...typography.caption,
      color: c.text,
      marginRight: spacing.sm,
    },
    existingBudgetItemAmount: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.textMuted,
    },
    teamSectionHint: {
      ...typography.micro,
      color: c.textMuted,
      marginBottom: spacing.md,
      lineHeight: 17,
    },
    teamRow: {
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    teamRowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    teamMoveIcon: {
      ...typography.subheading,
      color: c.primary,
    },
    teamMoveIconDisabled: {
      color: c.textMuted,
      opacity: 0.4,
    },
    teamPhotoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 4,
      marginBottom: spacing.sm + 4,
    },
    teamPhoto: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
    },
    teamPhotoEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
    },
    teamPhotoEmptyIcon: {
      ...typography.subheading,
      color: c.textMuted,
    },
    teamPhotoAction: {
      ...typography.captionStrong,
      color: c.primary,
    },
    teamIncomplete: {
      ...typography.micro,
      color: c.warning,
      marginTop: -spacing.sm,
      marginBottom: spacing.sm,
    },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    attachmentInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    attachmentName: {
      ...typography.captionStrong,
      color: c.text,
    },
    attachmentMeta: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
    },
    attachmentRules: {
      ...typography.micro,
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    projectSubmittedNotice: {
      ...typography.captionStrong,
      color: c.success,
      marginBottom: spacing.md,
    },
  });
