import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, shadow, ThemeColors, useTheme, useThemeStyles } from '../theme';

// The app ships no logo asset yet, so the auth screens carry a typographic mark.
// Swapping it for an <Image> later is a one-file change.
export function BrandMark({ size = 60 }: { size?: number }) {
  const styles = useThemeStyles(createStyles);
  const { scheme } = useTheme();

  return (
    <View style={[styles.mark, shadow(scheme), { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Text style={[styles.text, { fontSize: size * 0.43 }]}>IP</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    mark: {
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.xl,
    },
    text: {
      color: c.textOnAccent,
      fontWeight: '700',
      letterSpacing: -1,
    },
  });
