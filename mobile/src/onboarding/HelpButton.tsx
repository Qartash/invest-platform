import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  focusRing,
  maxWidth,
  PressableState,
  radius,
  spacing,
  ThemeColors,
  typography,
  useThemeStyles,
} from '../theme';
import { Dialog } from '../components/ui';
import { stepsForScreen } from './steps';
import { useTourStore } from './tourStore';
import { TourId } from './types';

interface Props {
  /**
   * The step-id prefix this screen owns — `wallet`, `project`, `referrals`. Every tour step
   * under it is listed, which is why the prefixes in `steps.ts` are named after screens.
   */
  topic: string;
  /** Offered as "walk me through it" at the foot of the sheet. */
  tour?: TourId;
}

/**
 * The `?` in a screen's header: every explanation that screen has, as a list, at any time.
 *
 * Deliberately not a tour. Someone who taps `?` is stuck on the screen they are looking at
 * and wants an answer without being marched around the app; the tour is the other half of
 * the same content, offered at the bottom for anyone who does want the walk.
 */
export function HelpButton({ topic, tour }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const startTour = useTourStore((s) => s.startTour);

  const steps = stepsForScreen(topic);
  if (steps.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('guide.helpLabel')}
        hitSlop={8}
        style={({ pressed, hovered, focused }: PressableState) => [
          styles.button,
          (pressed || hovered) && styles.buttonActive,
          focused && styles.buttonFocused,
        ]}
      >
        <Text style={styles.buttonText}>?</Text>
      </Pressable>

      <Dialog visible={open} onClose={() => setOpen(false)} sheet maxWidth={maxWidth.dialogMd}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t('guide.helpTitle')}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {steps.map((step) => (
              <View key={step.id} style={styles.item}>
                <Text style={styles.itemTitle}>{t(`guide.steps.${step.id}.title`)}</Text>
                <Text style={styles.itemBody}>{t(`guide.steps.${step.id}.body`)}</Text>
              </View>
            ))}
          </ScrollView>

          {tour && (
            <Pressable
              style={styles.tourButton}
              onPress={() => {
                setOpen(false);
                startTour(tour);
              }}
            >
              <Text style={styles.tourText}>{t('guide.startTour')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.close} onPress={() => setOpen(false)} hitSlop={6}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </Dialog>
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    button: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonActive: {
      backgroundColor: c.primarySoft,
    },
    buttonFocused: focusRing(c),
    buttonText: {
      ...typography.captionStrong,
      color: c.primary,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderRadius: radius.xl,
      padding: spacing.md,
      paddingBottom: spacing.lg,
      maxHeight: '100%',
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.heading,
      color: c.text,
      marginBottom: spacing.sm,
    },
    list: {
      maxHeight: 420,
    },
    listContent: {
      paddingBottom: spacing.sm,
    },
    item: {
      paddingVertical: spacing.sm + 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    itemTitle: {
      ...typography.labelStrong,
      color: c.text,
      marginBottom: 2,
    },
    itemBody: {
      ...typography.caption,
      color: c.textMuted,
      lineHeight: 19,
    },
    tourButton: {
      marginTop: spacing.md,
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 3,
      alignItems: 'center',
    },
    tourText: {
      ...typography.captionStrong,
      color: c.textOnAccent,
    },
    close: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
    },
    closeText: {
      ...typography.caption,
      color: c.textMuted,
    },
  });
