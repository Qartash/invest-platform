import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { resolveMediaUrl } from '../api/client';
import { radius, spacing, ThemeColors, typography, useThemeStyles } from '../theme';
import { Card } from './ui';

interface Props {
  name: string;
  role: string;
  bio?: string | null;
  photoUrl?: string | null;
}

/** Initials stand in for a missing photo — a grey silhouette says nothing about the person. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function TeamMemberCard({ name, role, bio, photoUrl }: Props) {
  const styles = useThemeStyles(createStyles);
  const resolved = photoUrl ? resolveMediaUrl(photoUrl) : null;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {resolved ? (
          <Image source={{ uri: resolved }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoFallback]}>
            <Text style={styles.initials}>{initials(name)}</Text>
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.role} numberOfLines={2}>
            {role}
          </Text>
        </View>
      </View>
      {!!bio && <Text style={styles.bio}>{bio}</Text>}
    </Card>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md - 4,
    },
    photo: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
    },
    photoFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      ...typography.captionStrong,
      color: c.textMuted,
    },
    text: {
      flex: 1,
    },
    name: {
      ...typography.subheading,
      color: c.text,
    },
    role: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 1,
    },
    bio: {
      ...typography.label,
      color: c.text,
      marginTop: spacing.sm + 2,
      paddingTop: spacing.sm + 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
      lineHeight: 20,
    },
  });
