import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Answer,
  Question,
  QuestionSort,
  SimilarQuestion,
  VoteKind,
  answerQuestion,
  askQuestion,
  deleteQuestion,
  fetchQuestions,
  fetchSimilarQuestions,
  followQuestion,
  reportContent,
  voteOn,
} from '../api/projectSocial';
import { Project } from '../types';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';
import { apiErrorMessage } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import { minutesLeftToAnswer } from '../utils/responsiveness';
import { Avatar } from './Avatar';
import { ResponsivenessBadge } from './ResponsivenessBadge';
import { Card, Icon, Pill, SectionHeader } from './ui';
import { PrimaryButton } from './PrimaryButton';
import {
  PressableState,
  radius,
  spacing,
  ThemeColors,
  typography,
  useTheme,
  useThemeStyles,
} from '../theme';

interface Props {
  project: Project;
  /** Refreshes the project so the responsiveness header follows an answer. */
  onChanged?: () => void;
}

const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 1000;

/**
 * The questions tab: what investors asked, what the founder said, and how long
 * they took.
 *
 * One component for both sides. A founder sees the same list as everyone else
 * with an answer box under each unanswered question and a countdown on it —
 * rather than a separate console — because the queue and the public record are
 * the same thing seen from two angles, and keeping them one screen means a
 * founder cannot answer in a place investors do not read.
 */
export function ProjectQuestionsPanel({ project, onChanged }: Props) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);

  const [sort, setSort] = useState<QuestionSort>('top');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [unanswered, setUnanswered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const isFounder = !!user && user.id === project.founderId;

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const page = await fetchQuestions(project.id, sort);
      setQuestions(page.items);
      setUnanswered(page.unanswered);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [project.id, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  // Applies a server result to one question in place. Reloading the whole list
  // after every vote would lose the reader's position and re-sort the list under
  // their finger, which is exactly the thing that makes voting feel unsafe.
  const patchQuestion = useCallback((id: string, patch: (question: Question) => Question) => {
    setQuestions((current) => current.map((question) => (question.id === id ? patch(question) : question)));
  }, []);

  const onVoteQuestion = useCallback(
    async (question: Question) => {
      try {
        const result = await voteOn('question', question.id, 'up');
        patchQuestion(question.id, (current) => ({
          ...current,
          upvoteCount: result.count,
          myVotes: result.voted ? [...current.myVotes, 'up'] : current.myVotes.filter((k) => k !== 'up'),
        }));
      } catch (err) {
        showAlert(t('common.error'), apiErrorMessage(err, t));
      }
    },
    [patchQuestion, t],
  );

  const onVoteAnswer = useCallback(
    async (question: Question, answer: Answer, kind: VoteKind) => {
      try {
        const result = await voteOn('answer', answer.id, kind);
        patchQuestion(question.id, (current) => ({
          ...current,
          answers: current.answers.map((item) =>
            item.id === answer.id
              ? {
                  ...item,
                  helpfulCount: kind === 'helpful' ? result.count : item.helpfulCount,
                  notAnswerCount: kind === 'not_answer' ? result.count : item.notAnswerCount,
                  myVotes: result.voted
                    ? [...item.myVotes, kind]
                    : item.myVotes.filter((k) => k !== kind),
                }
              : item,
          ),
        }));
      } catch (err) {
        showAlert(t('common.error'), apiErrorMessage(err, t));
      }
    },
    [patchQuestion, t],
  );

  const sorts: Array<{ key: QuestionSort; label: string; badge?: number }> = useMemo(
    () => [
      { key: 'top', label: t('social.sort.top') },
      { key: 'new', label: t('social.sort.new') },
      { key: 'unanswered', label: t('social.sort.unanswered'), badge: unanswered || undefined },
    ],
    [t, unanswered],
  );

  return (
    <View style={styles.wrap}>
      {/* The figure a founder is judged on, shown to them as well — it is only
          a lever if the person it applies to can see it moving. */}
      <Card style={styles.header}>
        <ResponsivenessBadge project={project} variant="row" />
        {project.questionsCount === 0 && (
          <Text style={styles.headerEmpty}>{t('social.header.noQuestionsYet')}</Text>
        )}
      </Card>

      {!isFounder && <AskBox project={project} onAsked={() => void load()} />}

      <View style={styles.sortRow}>
        {sorts.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setSort(item.key)}
            style={({ pressed }: PressableState) => [
              styles.chip,
              sort === item.key && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, sort === item.key && styles.chipTextActive]}>{item.label}</Text>
            {item.badge ? <Text style={styles.chipBadge}>{item.badge}</Text> : null}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Text style={styles.muted}>{t('common.loading')}</Text>
      ) : failed ? (
        <Pressable onPress={() => void load()}>
          <Text style={styles.muted}>{t('errors.loadFailed')}</Text>
        </Pressable>
      ) : questions.length === 0 ? (
        <Card style={styles.empty}>
          <Icon name="comment" size={26} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('social.empty.title')}</Text>
          <Text style={styles.emptyBody}>
            {isFounder ? t('social.empty.founderBody') : t('social.empty.body')}
          </Text>
        </Card>
      ) : (
        questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            isFounder={isFounder}
            onVote={() => void onVoteQuestion(question)}
            onVoteAnswer={(answer, kind) => void onVoteAnswer(question, answer, kind)}
            onChanged={() => {
              void load();
              onChanged?.();
            }}
          />
        ))
      )}
    </View>
  );
}

// ── Asking ───────────────────────────────────────────────────────────────────

function AskBox({ project, onAsked }: { project: Project; onAsked: () => void }) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const [body, setBody] = useState('');
  const [similar, setSimilar] = useState<SimilarQuestion[]>([]);
  const [sending, setSending] = useState(false);

  // Looks for questions that already exist while the person is still typing.
  // Half the duplicates never get sent, which is half of a founder's queue that
  // never appears — and the asker gets their answer immediately.
  useEffect(() => {
    if (body.trim().length < 8) {
      setSimilar([]);
      return;
    }
    const timer = setTimeout(() => {
      fetchSimilarQuestions(project.id, body)
        .then(setSimilar)
        .catch(() => setSimilar([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [body, project.id]);

  const send = async () => {
    setSending(true);
    try {
      await askQuestion(project.id, body.trim());
      setBody('');
      setSimilar([]);
      onAsked();
    } catch (err) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setSending(false);
    }
  };

  const tooLong = body.length > MAX_QUESTION_LENGTH;

  return (
    <Card style={styles.composer}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t('social.ask.placeholder')}
        multiline
        style={styles.input}
        maxLength={MAX_QUESTION_LENGTH + 40}
      />
      {similar.length > 0 && (
        <View style={styles.similar}>
          <Text style={styles.similarTitle}>{t('social.ask.similar')}</Text>
          {similar.map((item) => (
            <View key={item.id} style={styles.similarRow}>
              <Text style={styles.similarBody} numberOfLines={2}>
                {item.body}
              </Text>
              {item.answered && <Pill label={t('social.answered')} tone="success" />}
            </View>
          ))}
        </View>
      )}
      <View style={styles.composerFoot}>
        <Text style={[styles.counter, tooLong && styles.counterOver]}>
          {body.length} / {MAX_QUESTION_LENGTH}
        </Text>
        <PrimaryButton
          title={t('social.ask.send')}
          onPress={() => void send()}
          disabled={sending || body.trim().length < 5 || tooLong}
          size="small"
        />
      </View>
      <Text style={styles.notice}>{t('social.ask.publicNotice')}</Text>
    </Card>
  );
}

// ── One question ─────────────────────────────────────────────────────────────

interface RowProps {
  question: Question;
  isFounder: boolean;
  onVote: () => void;
  onVoteAnswer: (answer: Answer, kind: VoteKind) => void;
  onChanged: () => void;
}

function QuestionRow({ question, isFounder, onVote, onVoteAnswer, onChanged }: RowProps) {
  const { t, i18n } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [alsoPost, setAlsoPost] = useState(false);
  const [pin, setPin] = useState(question.pinned);
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(question.following);

  const minutesLeft = minutesLeftToAnswer(question.createdAt);
  const overdue = minutesLeft < 0;

  const send = async () => {
    setBusy(true);
    try {
      await answerQuestion(
        question.id,
        reply.trim(),
        isFounder ? { alsoPostAsUpdate: alsoPost, pin } : {},
      );
      setReply('');
      setReplying(false);
      onChanged();
    } catch (err) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    showAlert(t('social.delete.title'), t('social.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteQuestion(question.id)
            .then(onChanged)
            .catch((err) => showAlert(t('common.error'), apiErrorMessage(err, t)));
        },
      },
    ]);
  };

  const report = () => {
    reportContent('question', question.id, 'other')
      .then(() => showAlert(t('social.report.sentTitle'), t('social.report.sentBody')))
      .catch((err) => showAlert(t('common.error'), apiErrorMessage(err, t)));
  };

  return (
    <Card style={styles.question}>
      <View style={styles.qHead}>
        <Avatar
          size={34}
          avatarUrl={question.author?.avatarUrl}
          avatarEmoji={question.author?.avatarEmoji}
        />
        <View style={styles.qWho}>
          <Text style={styles.qName}>
            {question.author?.fullName ?? t('social.deletedUser')}
          </Text>
          <Text style={styles.qTime}>{formatDateTime(question.createdAt, i18n.language)}</Text>
        </View>
        {question.pinned && <Icon name="star" size={15} color={colors.warning} />}
      </View>

      {question.hidden ? (
        <View style={styles.hidden}>
          <Text style={styles.hiddenLabel}>{t('social.hidden.title')}</Text>
          {question.hiddenReason && <Text style={styles.hiddenReason}>{question.hiddenReason}</Text>}
          {question.body && <Text style={styles.qBody}>{question.body}</Text>}
        </View>
      ) : (
        <Text style={styles.qBody}>{question.body}</Text>
      )}

      {question.answers.map((answer) => (
        <View key={answer.id} style={[styles.answer, answer.fromFounder && styles.answerFounder]}>
          <View style={styles.aHead}>
            <Text style={[styles.aName, answer.fromFounder && styles.aNameFounder]}>
              {answer.author?.fullName ?? t('social.deletedUser')}
            </Text>
            {answer.fromFounder && <Pill label={t('social.founder')} tone="primary" />}
            <Text style={styles.qTime}>{formatDateTime(answer.createdAt, i18n.language)}</Text>
          </View>
          <Text style={styles.aBody}>{answer.body}</Text>
          <View style={styles.voteRow}>
            {/* Two verdicts, not one. "Helped" alone would let an answer that
                dodges the question look the same as one that answers it. */}
            <VoteButton
              icon="check"
              label={t('social.vote.helped', { count: answer.helpfulCount })}
              active={answer.myVotes.includes('helpful')}
              tone="success"
              onPress={() => onVoteAnswer(answer, 'helpful')}
            />
            <VoteButton
              icon="flag"
              label={t('social.vote.notAnAnswer', { count: answer.notAnswerCount })}
              active={answer.myVotes.includes('not_answer')}
              tone="danger"
              onPress={() => onVoteAnswer(answer, 'not_answer')}
            />
          </View>
        </View>
      ))}

      {!question.answered && !question.hidden && (
        <View style={[styles.awaiting, overdue && styles.awaitingOverdue]}>
          <Icon name="clock" size={13} color={overdue ? colors.danger : colors.textMuted} />
          <Text style={[styles.awaitingText, overdue && styles.awaitingTextOverdue]}>
            {isFounder
              ? overdue
                ? t('social.queue.overdue')
                : t('social.queue.hoursLeft', { count: Math.max(1, Math.round(minutesLeft / 60)) })
              : t('social.awaitingAnswer')}
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <VoteButton
          icon="trendUp"
          label={String(question.upvoteCount)}
          active={question.myVotes.includes('up')}
          tone="primary"
          onPress={onVote}
          disabled={question.mine}
        />
        {!question.mine && (
          <Pressable onPress={() => setReplying((current) => !current)} hitSlop={6}>
            <Text style={styles.flatAction}>
              {isFounder && !question.answered ? t('social.answerAction') : t('social.replyAction')}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            const next = !following;
            setFollowing(next);
            followQuestion(question.id, next).catch(() => setFollowing(!next));
          }}
          hitSlop={6}
        >
          <Text style={[styles.flatAction, following && styles.flatActionOn]}>
            {following ? t('social.following') : t('social.follow')}
          </Text>
        </Pressable>
        {question.editable && (
          <Pressable onPress={remove} hitSlop={6}>
            <Text style={styles.flatActionDanger}>{t('common.delete')}</Text>
          </Pressable>
        )}
        {!question.mine && (
          <Pressable onPress={report} hitSlop={6}>
            <Text style={styles.flatAction}>{t('social.report.action')}</Text>
          </Pressable>
        )}
      </View>

      {replying && (
        <View style={styles.replyBox}>
          <TextInput
            value={reply}
            onChangeText={setReply}
            placeholder={isFounder ? t('social.answer.placeholder') : t('social.reply.placeholder')}
            multiline
            style={styles.input}
            maxLength={MAX_ANSWER_LENGTH + 40}
          />
          {isFounder && (
            <View style={styles.switches}>
              {/* The switch that turns one good answer into news for every
                  holder instead of for the few people reading this thread. */}
              <Toggle
                label={t('social.answer.alsoPost')}
                hint={t('social.answer.alsoPostHint')}
                value={alsoPost}
                onChange={setAlsoPost}
              />
              <Toggle
                label={t('social.answer.pin')}
                hint={t('social.answer.pinHint')}
                value={pin}
                onChange={setPin}
              />
            </View>
          )}
          <View style={styles.composerFoot}>
            <Text style={styles.counter}>
              {reply.length} / {MAX_ANSWER_LENGTH}
            </Text>
            <PrimaryButton
              title={t('social.answer.send')}
              onPress={() => void send()}
              disabled={busy || reply.trim().length < 2}
              size="small"
            />
          </View>
        </View>
      )}
    </Card>
  );
}

// ── Small parts ──────────────────────────────────────────────────────────────

function VoteButton({
  icon,
  label,
  active,
  tone,
  onPress,
  disabled,
}: {
  icon: 'trendUp' | 'check' | 'flag';
  label: string;
  active: boolean;
  tone: 'primary' | 'success' | 'danger';
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const activeColor = tone === 'primary' ? colors.primary : tone === 'success' ? colors.success : colors.danger;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }: PressableState) => [
        styles.vote,
        active && { backgroundColor: `${activeColor}22`, borderColor: 'transparent' },
        disabled && styles.voteDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={13} color={active ? activeColor : colors.textMuted} />
      <Text style={[styles.voteLabel, active && { color: activeColor }]}>{label}</Text>
    </Pressable>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <View style={[styles.toggleTrack, value && { backgroundColor: colors.primary }]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    header: { gap: spacing.sm },
    headerEmpty: { ...typography.caption, color: c.textMuted },
    pressed: { opacity: 0.75 },
    muted: { ...typography.caption, color: c.textMuted, textAlign: 'center', paddingVertical: spacing.lg },

    sortRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    chipActive: { backgroundColor: c.primarySoft, borderColor: 'transparent' },
    chipText: { ...typography.captionStrong, color: c.textMuted },
    chipTextActive: { color: c.primary },
    chipBadge: {
      ...typography.microStrong,
      color: c.warning,
      backgroundColor: c.warningSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
    },

    composer: { gap: spacing.sm },
    input: {
      ...typography.body,
      color: c.text,
      minHeight: 76,
      textAlignVertical: 'top',
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    composerFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    counter: { ...typography.micro, color: c.textMuted },
    counterOver: { color: c.danger },
    notice: { ...typography.micro, color: c.textMuted },

    similar: { gap: spacing.xs, backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: spacing.sm },
    similarTitle: { ...typography.microStrong, color: c.textMuted, textTransform: 'uppercase' },
    similarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    similarBody: { ...typography.caption, color: c.text, flex: 1 },

    empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
    emptyTitle: { ...typography.subheading, color: c.text },
    emptyBody: { ...typography.caption, color: c.textMuted, textAlign: 'center' },

    question: { gap: spacing.sm },
    qHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    qWho: { flex: 1 },
    qName: { ...typography.labelStrong, color: c.text },
    qTime: { ...typography.micro, color: c.textMuted },
    qBody: { ...typography.body, color: c.text },

    hidden: { gap: 4, backgroundColor: c.dangerSoft, borderRadius: radius.md, padding: spacing.sm },
    hiddenLabel: { ...typography.captionStrong, color: c.danger },
    hiddenReason: { ...typography.micro, color: c.danger },

    answer: {
      gap: spacing.xs,
      borderLeftWidth: 3,
      borderLeftColor: c.border,
      backgroundColor: c.surfaceSunken,
      borderTopRightRadius: radius.md,
      borderBottomRightRadius: radius.md,
      padding: spacing.sm,
    },
    answerFounder: { borderLeftColor: c.primary, backgroundColor: c.primarySoft },
    aHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
    aName: { ...typography.captionStrong, color: c.text },
    aNameFounder: { color: c.primary },
    aBody: { ...typography.label, color: c.text },

    awaiting: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: c.surfaceSunken,
      padding: spacing.sm,
    },
    awaitingOverdue: { backgroundColor: c.dangerSoft },
    awaitingText: { ...typography.micro, color: c.textMuted },
    awaitingTextOverdue: { color: c.danger },

    voteRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
    vote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    voteDisabled: { opacity: 0.45 },
    voteLabel: { ...typography.microStrong, color: c.textMuted },
    flatAction: { ...typography.captionStrong, color: c.textMuted },
    flatActionOn: { color: c.primary },
    flatActionDanger: { ...typography.captionStrong, color: c.danger },

    replyBox: { gap: spacing.sm },
    switches: { gap: spacing.xs },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    toggleText: { flex: 1 },
    toggleLabel: { ...typography.captionStrong, color: c.text },
    toggleHint: { ...typography.micro, color: c.textMuted },
    toggleTrack: {
      width: 42,
      height: 24,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
    toggleKnobOn: { alignSelf: 'flex-end' },
  });
