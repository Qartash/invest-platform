import React from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { spacing } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Cap on the dialog's width — reach for a `maxWidth` token rather than a number. */
  maxWidth?: number;
  /** Rise from the bottom edge on a phone, stay centred once there is room. */
  sheet?: boolean;
  children: React.ReactNode;
}

// Below this the screen is a phone and a `sheet` dialog takes the bottom-sheet posture.
const SHEET_BREAKPOINT = 600;

// The one overlay every dialog in the app sits in. It owns the scrim, the click-outside
// and Escape dismissals, and the width cap that keeps a dialog from spanning a desktop
// window; callers bring nothing but the card and its contents.
export function Dialog({ visible, onClose, maxWidth, sheet, children }: Props) {
  const { width } = useWindowDimensions();
  const asSheet = !!sheet && width < SHEET_BREAKPOINT;

  return (
    // On web `onRequestClose` is what react-native-web calls for Escape, so that dismissal
    // comes free with the one Android hardware-back handler we already need.
    <Modal
      visible={visible}
      transparent
      animationType={asSheet ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <Pressable style={[styles.root, asSheet ? styles.rootSheet : styles.rootCentered, styles.scrim]} onPress={onClose}>
        <Pressable
          style={[asSheet ? styles.surfaceSheet : styles.surfaceCentered, !asSheet && !!maxWidth && { maxWidth }]}
          onPress={() => {}}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootCentered: {
    justifyContent: 'center',
    padding: spacing.lg,
  },
  rootSheet: {
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // The height cap belongs here, not on the card: a card that caps itself resolves the
  // percentage against this wrapper, whose height it just determined, and so ends up
  // clamped to a fraction of its own content and quietly loses the bottom of itself. This
  // node is measured against the full-height root, which is what 85% is meant to mean.
  // A card that can outgrow the cap needs `flexShrink: 1` to yield to it — views default
  // to 0 and would otherwise spill out rather than let an inner ScrollView take over.
  surfaceCentered: {
    width: '100%',
    alignSelf: 'center',
    maxHeight: '85%',
  },
  surfaceSheet: {
    width: '100%',
    maxHeight: '90%',
  },
});
