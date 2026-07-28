import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  focusRing,
  maxWidth,
  PressableState,
  radius,
  spacing,
  ThemeColors,
  typography,
  useTheme,
  useThemeStyles,
} from '../theme';
import { Card, Icon, ListGroup, ListRow, PageContainer, Pill, SectionHeader } from '../components/ui';
import { GUIDE_ARTICLES, TOURS, useTourStore } from '../onboarding';
import { TourId } from '../onboarding/types';
import { useAuthStore } from '../store/authStore';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Guide'>;

const TOUR_ORDER: TourId[] = ['investor', 'founder', 'referrals', 'admin'];

/**
 * The half of onboarding that outlives the tour.
 *
 * Someone who skipped the walkthrough on day one, or took it and has since forgotten which
 * figure means what, needs a place to read rather than a thing to sit through — so the
 * articles come first and the tours are offered underneath them.
 */
export function GuideScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const completed = useTourStore((s) => s.completed);
  const startTour = useTourStore((s) => s.startTour);
  const resetAll = useTourStore((s) => s.resetAll);
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  const tours = TOUR_ORDER.filter((id) => id !== 'admin' || isAdmin);

  // Starting a tour means leaving this screen — the overlay drives the navigation itself, and
  // the first step is somewhere else entirely.
  const runTour = (id: TourId) => {
    navigation.navigate('Profile');
    startTour(id);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageContainer maxWidth={maxWidth.column}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{t('guide.heroEyebrow')}</Text>
          <Text style={styles.heroTitle}>{t('guide.heroTitle')}</Text>
          <Text style={styles.heroBody}>{t('guide.heroBody')}</Text>
          <Pressable style={styles.heroButton} onPress={() => runTour('investor')}>
            <Text style={styles.heroButtonText}>
              {t('guide.startFull', { count: TOURS.investor.steps.length })}
            </Text>
          </Pressable>
        </Card>

        <SectionHeader title={t('guide.articlesTitle')} spaced />
        <View style={styles.articles}>
          {GUIDE_ARTICLES.map((article) => {
            const expanded = openArticle === article.id;
            return (
              <View key={article.id} style={styles.article}>
                <Pressable
                  onPress={() => setOpenArticle(expanded ? null : article.id)}
                  style={({ pressed, hovered, focused }: PressableState) => [
                    styles.articleHead,
                    (pressed || hovered) && styles.articleHeadActive,
                    focused && styles.articleHeadFocused,
                  ]}
                >
                  <View style={styles.plaque}>
                    <Icon name={article.icon} color={colors.primary} size={17} />
                  </View>
                  <Text style={styles.articleTitle}>{t(`guide.articles.${article.id}.title`)}</Text>
                  <Icon name={expanded ? 'chevronUp' : 'chevronDown'} color={colors.textMuted} size={16} />
                </Pressable>
                {expanded && (
                  <View style={styles.articleBody}>
                    <Text style={styles.articleText}>{t(`guide.articles.${article.id}.body`)}</Text>
                    {article.tour && (
                      <Pressable style={styles.inlineTour} onPress={() => runTour(article.tour!)} hitSlop={6}>
                        <Text style={styles.inlineTourText}>{t('guide.startTour')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <SectionHeader title={t('guide.toursTitle')} spaced />
        <ListGroup>
          {tours.map((id) => (
            <ListRow
              key={id}
              label={t(`guide.tours.${id}.title`)}
              sublabel={t('guide.stepCount', { count: TOURS[id].steps.length })}
              right={completed[id] ? <Pill label={t('guide.passed')} tone="success" /> : undefined}
              onPress={() => runTour(id)}
            />
          ))}
        </ListGroup>

        <Pressable style={styles.reset} onPress={resetAll} hitSlop={8}>
          <Text style={styles.resetText}>{t('guide.reset')}</Text>
        </Pressable>
        <Text style={styles.resetHint}>{t('guide.resetHint')}</Text>
      </PageContainer>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      paddingBottom: spacing.xl,
    },

    // The one saturated surface in the app outside a primary button: this card is the
    // invitation, and it has to read as one before a word of it is read.
    heroCard: {
      borderRadius: radius.xl,
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    heroEyebrow: {
      ...typography.eyebrow,
      color: c.textOnAccentMuted,
    },
    heroTitle: {
      ...typography.title,
      color: c.textOnAccent,
      marginTop: spacing.xs,
    },
    heroBody: {
      ...typography.label,
      color: c.textOnAccentMuted,
      lineHeight: 21,
      marginTop: spacing.sm - 2,
    },
    heroButton: {
      marginTop: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      alignItems: 'center',
    },
    heroButtonText: {
      ...typography.captionStrong,
      color: c.primary,
    },

    articles: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    article: {
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    articleHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    articleHeadActive: {
      backgroundColor: c.primarySoft,
    },
    articleHeadFocused: { ...focusRing(c), outlineOffset: -2 },
    plaque: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    articleTitle: {
      ...typography.labelStrong,
      color: c.text,
      flex: 1,
    },
    articleBody: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: c.surfaceSunken,
      paddingTop: spacing.sm,
    },
    articleText: {
      ...typography.caption,
      color: c.text,
      lineHeight: 20,
    },
    inlineTour: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: c.primarySoft,
    },
    inlineTourText: {
      ...typography.captionStrong,
      color: c.primary,
    },

    reset: {
      alignSelf: 'center',
      marginTop: spacing.xl,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    resetText: {
      ...typography.captionStrong,
      color: c.primary,
    },
    resetHint: {
      ...typography.micro,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
  });
