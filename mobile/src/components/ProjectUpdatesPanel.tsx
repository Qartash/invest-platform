import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ProjectUpdate,
  fetchUpdates,
  markUpdateRead,
  postUpdate,
  voteOn,
} from '../api/projectSocial';
import { resolveMediaUrl } from '../api/client';
import { Project } from '../types';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';
import { apiErrorMessage } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import { Card, Icon, Pill } from './ui';
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
}

const MAX_TITLE = 120;
const MAX_BODY = 2000;

/**
 * News from the founder to the people who put money in — and, between those, the
 * posts the platform writes itself when a financial report is published.
 *
 * The automatic ones are why this tab is not empty in month two. A founder who
 * never writes a word still has a feed that says the books were closed and what
 * they showed, because the reporting flow announces itself.
 */
export function ProjectUpdatesPanel({ project }: Props) {
  const { t, i18n } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isFounder = !!user && user.id === project.founderId;

  const [posts, setPosts] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await fetchUpdates(project.id);
      setPosts(page.items);
      // Counting a read is the founder's only signal that anyone is listening.
      // Fired for the top post only, and never awaited: it must not delay or
      // break the render.
      if (page.items[0]) void markUpdateRead(page.items[0].id).catch(() => undefined);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onHelpful = async (post: ProjectUpdate) => {
    try {
      const result = await voteOn('update', post.id, 'helpful');
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                helpfulCount: result.count,
                myVotes: result.voted
                  ? [...item.myVotes, 'helpful' as const]
                  : item.myVotes.filter((k) => k !== 'helpful'),
              }
            : item,
        ),
      );
    } catch (err) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    }
  };

  return (
    <View style={styles.wrap}>
      {isFounder &&
        (composing ? (
          <Composer
            project={project}
            onCancel={() => setComposing(false)}
            onPosted={() => {
              setComposing(false);
              void load();
            }}
          />
        ) : (
          <Card style={styles.prompt}>
            <View style={styles.promptText}>
              <Text style={styles.promptTitle}>{t('social.updates.promptTitle')}</Text>
              <Text style={styles.promptBody}>
                {project.lastUpdateAt
                  ? t('social.updates.promptSince', { date: formatDateTime(project.lastUpdateAt, i18n.language) })
                  : t('social.updates.promptNever')}
              </Text>
            </View>
            <PrimaryButton
              title={t('social.updates.write')}
              onPress={() => setComposing(true)}
              size="small"
            />
          </Card>
        ))}

      {loading ? (
        <Text style={styles.muted}>{t('common.loading')}</Text>
      ) : posts.length === 0 ? (
        <Card style={styles.empty}>
          <Icon name="file" size={26} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('social.updates.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('social.updates.emptyBody')}</Text>
        </Card>
      ) : (
        posts.map((post) => (
          <Card key={post.id} style={styles.post}>
            {post.auto ? (
              // A report post is figures with a link, not prose — rendering it as
              // a written update would put words in the founder's mouth.
              <View style={styles.autoRow}>
                <View style={styles.autoIcon}>
                  <Icon name="chart" size={17} color={colors.success} />
                </View>
                <View style={styles.autoText}>
                  <Text style={styles.postTitle}>{t('social.updates.reportTitle')}</Text>
                  <Text style={styles.autoFigures}>
                    {[
                      post.autoPayload?.revenue != null
                        ? t('social.updates.revenue', { amount: post.autoPayload.revenue.toLocaleString() })
                        : null,
                      post.autoPayload?.holders != null
                        ? t('social.updates.holders', { count: post.autoPayload.holders })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Pill label={t('social.updates.automatic')} tone="neutral" />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.postHead}>
                  <Text style={styles.postAuthor}>
                    {post.author?.fullName ?? t('social.deletedUser')}
                  </Text>
                  <Text style={styles.postTime}>{formatDateTime(post.createdAt, i18n.language)}</Text>
                  {post.editedAt && <Pill label={t('social.updates.edited')} tone="neutral" />}
                </View>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postBody}>{post.body}</Text>
                {post.photos.length > 0 && (
                  <View style={styles.photos}>
                    {post.photos.map((photo) => (
                      <Image
                        key={photo}
                        source={{ uri: resolveMediaUrl(photo) }}
                        style={styles.photo}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={styles.postFoot}>
              <Pressable
                onPress={() => void onHelpful(post)}
                hitSlop={6}
                style={({ pressed }: PressableState) => [
                  styles.vote,
                  post.myVotes.includes('helpful') && {
                    backgroundColor: `${colors.success}22`,
                    borderColor: 'transparent',
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  name="check"
                  size={13}
                  color={post.myVotes.includes('helpful') ? colors.success : colors.textMuted}
                />
                <Text
                  style={[
                    styles.voteLabel,
                    post.myVotes.includes('helpful') && { color: colors.success },
                  ]}
                >
                  {post.helpfulCount}
                </Text>
              </Pressable>
              {isFounder && (
                <Text style={styles.reach}>
                  {t('social.updates.readBy', { count: post.readCount })}
                </Text>
              )}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}

function Composer({
  project,
  onPosted,
  onCancel,
}: {
  project: Project;
  onPosted: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemeStyles(createStyles);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await postUpdate(project.id, { title: title.trim(), body: body.trim(), notifyHolders: notify });
      onPosted();
    } catch (err) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.composer}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('social.updates.titlePlaceholder')}
        style={styles.titleInput}
        maxLength={MAX_TITLE}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t('social.updates.bodyPlaceholder')}
        multiline
        style={styles.input}
        maxLength={MAX_BODY}
      />
      <Pressable onPress={() => setNotify((current) => !current)} style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>{t('social.updates.notify')}</Text>
          <Text style={styles.toggleHint}>{t('social.updates.notifyHint')}</Text>
        </View>
        <View style={[styles.toggleTrack, notify && styles.toggleTrackOn]}>
          <View style={[styles.toggleKnob, notify && styles.toggleKnobOn]} />
        </View>
      </Pressable>
      <View style={styles.composerFoot}>
        <Text style={styles.counter}>
          {body.length} / {MAX_BODY}
        </Text>
        <View style={styles.composerButtons}>
          <PrimaryButton title={t('common.cancel')} onPress={onCancel} variant="outline" size="small" />
          <PrimaryButton
            title={t('social.updates.publish')}
            onPress={() => void send()}
            disabled={busy || title.trim().length < 3 || body.trim().length < 10}
            size="small"
          />
        </View>
      </View>
      <Text style={styles.notice}>{t('social.updates.editWindow')}</Text>
    </Card>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.md },
    pressed: { opacity: 0.75 },
    muted: { ...typography.caption, color: c.textMuted, textAlign: 'center', paddingVertical: spacing.lg },

    prompt: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    promptText: { flex: 1 },
    promptTitle: { ...typography.labelStrong, color: c.text },
    promptBody: { ...typography.micro, color: c.textMuted },

    empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
    emptyTitle: { ...typography.subheading, color: c.text },
    emptyBody: { ...typography.caption, color: c.textMuted, textAlign: 'center' },

    post: { gap: spacing.sm },
    postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    postAuthor: { ...typography.captionStrong, color: c.text },
    postTime: { ...typography.micro, color: c.textMuted },
    postTitle: { ...typography.subheading, color: c.text },
    postBody: { ...typography.label, color: c.text },
    photos: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    photo: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: c.surfaceSunken },

    autoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    autoIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      backgroundColor: c.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    autoText: { flex: 1, gap: 4, alignItems: 'flex-start' },
    autoFigures: { ...typography.caption, color: c.textMuted },

    postFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    reach: { ...typography.micro, color: c.textMuted, marginLeft: 'auto' },
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
    voteLabel: { ...typography.microStrong, color: c.textMuted },

    composer: { gap: spacing.sm },
    titleInput: {
      ...typography.subheading,
      color: c.text,
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    input: {
      ...typography.body,
      color: c.text,
      minHeight: 96,
      textAlignVertical: 'top',
      backgroundColor: c.surfaceSunken,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    composerFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    composerButtons: { flexDirection: 'row', gap: spacing.sm },
    counter: { ...typography.micro, color: c.textMuted },
    notice: { ...typography.micro, color: c.textMuted },

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
    toggleTrackOn: { backgroundColor: c.primary },
    toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
    toggleKnobOn: { alignSelf: 'flex-end' },
  });
