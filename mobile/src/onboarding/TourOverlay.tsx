import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  maxWidth,
  radius,
  spacing,
  ThemeColors,
  typography,
  useThemeStyles,
} from '../theme';
import { awaitTarget, TargetRect } from './targets';

interface Props {
  /** Copy keys: `guide.steps.<stepId>.title` / `.body`. */
  stepId: string;
  /** Already measured by the host, which also owns navigating to the step's screen. */
  target?: string;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/** Breathing room between the cutout and the card, and between the card and the screen edge. */
const GAP = 12;
/** Below this, a card under (or over) the cutout would be squeezed into unreadability. */
const MIN_CARD_SPACE = 190;
/** How far the highlight ring sits outside the element it rings. */
const RING_INSET = 4;

type Placement = 'below' | 'above' | 'centre';

/**
 * The scrim, the cutout and the step card.
 *
 * The cutout is four rectangles rather than a mask: masking needs SVG on native and a
 * different technique again on the web, while four opaque views around a hole render
 * identically everywhere and cost nothing.
 *
 * A target that cannot be measured — its screen still mounting, scrolled out of view, or
 * simply absent on this account — is not an error. The card centres itself and the step
 * still reads; that is what lets the tour describe a resale shelf to someone whose feed
 * has no resale listings.
 */
export function TourOverlay({ stepId, target, index, total, onNext, onPrev, onSkip }: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rect, setRect] = useState<TargetRect | null>(null);

  // Re-measure on every step, and again whenever the window changes size — a browser window
  // dragged wider moves everything the previous measurement described.
  useEffect(() => {
    let cancelled = false;
    setRect(null);
    if (!target) return;
    awaitTarget(target).then((found) => {
      if (!cancelled) setRect(found);
    });
    return () => {
      cancelled = true;
    };
  }, [target, stepId, winW, winH]);

  // A box that has scrolled off the screen is worse than no box: the ring would be drawn
  // against an edge with nothing in it.
  const visible = rect && rect.y + rect.height > insets.top && rect.y < winH - insets.bottom;
  const hole = visible ? rect : null;

  const spaceBelow = hole ? winH - (hole.y + hole.height) - insets.bottom : 0;
  const spaceAbove = hole ? hole.y - insets.top : 0;
  const placement: Placement = !hole
    ? 'centre'
    : spaceBelow >= MIN_CARD_SPACE
      ? 'below'
      : spaceAbove >= MIN_CARD_SPACE
        ? 'above'
        : 'centre';

  const cardWidth = Math.min(winW - spacing.md * 2, maxWidth.dialogSm);
  const cardPosition =
    placement === 'below'
      ? { top: hole!.y + hole!.height + GAP + RING_INSET }
      : placement === 'above'
        ? { bottom: winH - hole!.y + GAP + RING_INSET }
        : { top: Math.max(insets.top + GAP, winH / 2 - 130) };

  const isLast = index === total - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSkip}>
      {/* The scrim swallows presses rather than closing: a stray tap mid-tour should not
          end it, and the element under the cutout must not be operable while it is being
          described — half the steps point at buttons that spend money. */}
      <View style={styles.root} pointerEvents="box-none">
        {hole ? (
          <>
            <View style={[styles.scrim, { left: 0, right: 0, top: 0, height: Math.max(0, hole.y - RING_INSET) }]} />
            <View
              style={[
                styles.scrim,
                { left: 0, right: 0, top: hole.y + hole.height + RING_INSET, bottom: 0 },
              ]}
            />
            <View
              style={[
                styles.scrim,
                {
                  left: 0,
                  width: Math.max(0, hole.x - RING_INSET),
                  top: hole.y - RING_INSET,
                  height: hole.height + RING_INSET * 2,
                },
              ]}
            />
            <View
              style={[
                styles.scrim,
                {
                  left: hole.x + hole.width + RING_INSET,
                  right: 0,
                  top: hole.y - RING_INSET,
                  height: hole.height + RING_INSET * 2,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  left: hole.x - RING_INSET,
                  top: hole.y - RING_INSET,
                  width: hole.width + RING_INSET * 2,
                  height: hole.height + RING_INSET * 2,
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.scrim, StyleSheet.absoluteFill]} />
        )}

        <View style={[styles.card, cardPosition, { width: cardWidth, marginLeft: -cardWidth / 2 }]}>
          <Text style={styles.eyebrow}>{t(`guide.steps.${stepId}.title`)}</Text>
          {/* Long steps scroll inside the card instead of growing past the screen edge. */}
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.body}>{t(`guide.steps.${stepId}.body`)}</Text>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.counter}>
              {index + 1} / {total}
            </Text>
            <View style={styles.actions}>
              {index > 0 && (
                <Pressable style={styles.ghostButton} onPress={onPrev} hitSlop={6}>
                  <Text style={styles.ghostText}>{t('common.back')}</Text>
                </Pressable>
              )}
              <Pressable style={styles.primaryButton} onPress={onNext} hitSlop={6}>
                <Text style={styles.primaryText}>{isLast ? t('guide.finish') : t('guide.next')}</Text>
              </Pressable>
            </View>
          </View>

          {!isLast && (
            <Pressable style={styles.skip} onPress={onSkip} hitSlop={6}>
              <Text style={styles.skipText}>{t('guide.skip')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    scrim: {
      position: 'absolute',
      backgroundColor: c.overlayStrong,
    },
    ring: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: c.primary,
      borderRadius: radius.lg,
    },
    card: {
      position: 'absolute',
      // Centred by pulling the box back by half its own width, which is the one way to
      // centre an absolutely positioned view without measuring it.
      left: '50%',
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.md,
    },
    eyebrow: {
      ...typography.eyebrow,
      color: c.primary,
      marginBottom: spacing.xs,
    },
    bodyScroll: {
      maxHeight: 160,
    },
    bodyContent: {
      paddingBottom: spacing.xs,
    },
    body: {
      ...typography.label,
      color: c.text,
      lineHeight: 21,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    counter: {
      ...typography.micro,
      color: c.textMuted,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    ghostButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.md,
    },
    ghostText: {
      ...typography.captionStrong,
      color: c.textMuted,
    },
    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
    primaryText: {
      ...typography.captionStrong,
      color: c.textOnAccent,
    },
    skip: {
      alignSelf: 'center',
      marginTop: spacing.xs,
      paddingVertical: spacing.xs,
    },
    skipText: {
      ...typography.micro,
      color: c.textMuted,
    },
  });
