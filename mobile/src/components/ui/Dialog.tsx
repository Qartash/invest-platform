import React from 'react';
import { Modal, Pressable, StyleSheet, ColorSchemeName } from 'react-native';
import {
  maxWidth as maxWidthTokens,
  spacing,
  ThemeColors,
  useBreakpoint,
  useThemeStyles,
} from '../../theme';

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Width ceiling for the centred card. Ignored while the dialog is a phone bottom sheet. */
  maxWidth?: number;
  /**
   * A phone-native bottom sheet below `md`, a centred dialog at and above it. Off by default:
   * most dialogs are centred at every width. The card's own chrome (a sheet's top-only
   * corners and grab handle) is the child's business — this only owns where the card sits.
   */
  sheet?: boolean;
  /**
   * Whether a press on the scrim closes. On by default; turn it off for a dialog that must be
   * dismissed by an explicit control — a form mid-edit that a stray tap shouldn't discard.
   */
  dismissable?: boolean;
  animationType?: 'fade' | 'slide' | 'none';
}

/**
 * The shared shell for every modal overlay.
 *
 * It carries the three things a modal needs that a bare `<Modal>` does not: a scrim that
 * closes on press (the click-outside every desktop user reaches for), a width cap so the
 * card doesn't stretch across a desktop window, and — for the two menus that want it — a
 * bottom-sheet posture on a phone that straightens into a centred dialog on a wide screen.
 *
 * Escape is not handled here because it needs no handling: react-native-web's Modal already
 * turns an Escape key press into `onRequestClose`, which every caller passes.
 */
export function Dialog({
  visible,
  onClose,
  children,
  maxWidth = maxWidthTokens.dialogMd,
  sheet = false,
  dismissable = true,
  animationType,
}: DialogProps) {
  const styles = useThemeStyles(createStyles);
  const { isCompact } = useBreakpoint();
  const asSheet = sheet && isCompact;
  const anim = animationType ?? (asSheet ? 'slide' : 'fade');

  return (
    <Modal visible={visible} transparent animationType={anim} onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, asSheet ? styles.backdropSheet : styles.backdropCenter]}
        onPress={dismissable ? onClose : undefined}
      >
        <Pressable
          // The handler is present but inert: it makes the card the press responder so a tap
          // on the card is not also seen by the scrim behind it. Without it, every tap inside
          // the dialog would close it.
          onPress={() => {}}
          style={asSheet ? styles.sheet : [styles.card, { maxWidth }]}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ThemeColors, scheme: ColorSchemeName) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.45)',
    },
    backdropCenter: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    backdropSheet: {
      justifyContent: 'flex-end',
    },
    card: {
      width: '100%',
      // Never taller than the window: a long dialog scrolls inside its own content rather
      // than pushing its buttons off the bottom of the screen.
      maxHeight: '100%',
    },
    sheet: {
      width: '100%',
    },
  });
