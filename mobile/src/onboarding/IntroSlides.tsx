import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { maxWidth, radius, spacing, ThemeColors, typography, useTheme, useThemeStyles } from '../theme';
import { Icon, IconName } from '../components/ui';
import { INTRO_SLIDES } from './steps';

interface Props {
  /** Tapped through to the end — the tour follows. */
  onDone: () => void;
  /** Dismissed. Read as "I know what this is", and the tour is not forced afterwards. */
  onSkip: () => void;
}

const SLIDE_ICON: Record<(typeof INTRO_SLIDES)[number], IconName> = {
  purpose: 'layers',
  ticket: 'tag',
  wallet: 'wallet',
  invite: 'users',
};

/**
 * The first thing a new account sees: what the platform is for, before any of its screens
 * are explained. Four slides, skippable from the first one — someone who already knows why
 * they signed up should not have to tap through an argument for it.
 */
export function IntroSlides({ onDone, onSkip }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const slide = INTRO_SLIDES[index];
  const isLast = index === INTRO_SLIDES.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
      <View style={[styles.backdrop, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.card}>
          <Pressable style={styles.skip} onPress={onSkip} hitSlop={8}>
            <Text style={styles.skipText}>{t('guide.skip')}</Text>
          </Pressable>

          <View style={styles.body}>
            <View style={styles.iconPlaque}>
              <Icon name={SLIDE_ICON[slide]} color={colors.primary} size={26} />
            </View>
            <Text style={styles.title}>{t(`guide.intro.${slide}.title`)}</Text>
            <ScrollView style={styles.textScroll} contentContainerStyle={styles.textContent}>
              <Text style={styles.text}>{t(`guide.intro.${slide}.body`)}</Text>
            </ScrollView>
          </View>

          <View style={styles.dots}>
            {INTRO_SLIDES.map((key, i) => (
              <View key={key} style={i === index ? styles.dotActive : styles.dot} />
            ))}
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => (isLast ? onDone() : setIndex(index + 1))}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{isLast ? t('guide.introStart') : t('guide.next')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlayStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    card: {
      width: '100%',
      maxWidth: maxWidth.dialogSm,
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
    },
    skip: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    skipText: {
      ...typography.micro,
      color: c.textMuted,
    },
    body: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    iconPlaque: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    textScroll: {
      maxHeight: 200,
      alignSelf: 'stretch',
    },
    textContent: {
      paddingBottom: spacing.xs,
    },
    text: {
      ...typography.label,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    dots: {
      flexDirection: 'row',
      alignSelf: 'center',
      alignItems: 'center',
      gap: spacing.xs + 1,
      marginBottom: spacing.md,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.border,
    },
    dotActive: {
      width: 18,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.primary,
    },
    primaryButton: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 3,
      alignItems: 'center',
    },
    primaryText: {
      ...typography.bodyStrong,
      color: c.textOnAccent,
    },
  });
