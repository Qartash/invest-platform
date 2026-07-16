import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resolveMediaUrl } from '../api/client';
import { ThemeColors, useThemeStyles } from '../theme';

interface Props {
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  size?: number;
}

export function Avatar({ avatarUrl, avatarEmoji, size = 56 }: Props) {
  const styles = useThemeStyles(createStyles);
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: resolveMediaUrl(avatarUrl) }} style={[styles.base, dimension]} />;
  }
  if (avatarEmoji) {
    return (
      <View style={[styles.base, styles.emojiWrap, dimension]}>
        <Text style={{ fontSize: size * 0.5 }}>{avatarEmoji}</Text>
      </View>
    );
  }
  return <View style={[styles.base, styles.placeholder, dimension]} />;
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: {
      backgroundColor: c.border,
    },
    emojiWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    placeholder: {
      borderWidth: 1,
      borderColor: c.border,
    },
  });
