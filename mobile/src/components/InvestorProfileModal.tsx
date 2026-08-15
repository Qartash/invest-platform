import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchInvestorProfile } from '../api/users';
import { getLocalizedText } from '../utils/localized';
import { formatDate } from '../utils/date';
import { InvestorProfile } from '../types';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { Dialog } from './ui';
import { PrimaryButton } from './PrimaryButton';
import { Avatar } from './Avatar';
import { RichTextView } from './RichTextView';

interface Props {
  visible: boolean;
  investorId: string | null;
  excludeProjectId?: string;
  investedQuantity?: number;
  investedAmount?: number;
  onClose: () => void;
}

export function InvestorProfileModal({
  visible,
  investorId,
  excludeProjectId,
  investedQuantity,
  investedAmount,
  onClose,
}: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<InvestorProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !investorId) {
      setProfile(null);
      return;
    }
    setLoading(true);
    fetchInvestorProfile(investorId)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [visible, investorId]);

  const otherProjects = (profile?.projects ?? []).filter((p) => p.id !== excludeProjectId);

  return (
    <Dialog visible={visible} onClose={onClose}>
      <View style={styles.card}>
          {loading || !profile ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ScrollView>
              <View style={styles.headerRow}>
                <Avatar avatarUrl={profile.avatarUrl} avatarEmoji={profile.avatarEmoji} size={64} />
                <View style={styles.headerText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{profile.fullName}</Text>
                    {profile.role === 'admin' && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>🛡 {t('profile.adminBadge')}</Text>
                      </View>
                    )}
                  </View>
                  {profile.occupation && <Text style={styles.meta}>{profile.occupation}</Text>}
                  {profile.verified && <Text style={styles.verified}>✓ {t('profile.verified')}</Text>}
                </View>
              </View>

              <View style={styles.statsRow}>
                {profile.age != null && (
                  <Text style={styles.meta}>
                    {t('profile.age')}: {profile.age}
                  </Text>
                )}
                {profile.gender && <Text style={styles.meta}>{t(`profile.gender${capitalize(profile.gender)}`)}</Text>}
              </View>
              <Text style={styles.meta}>
                {t('profile.memberSince')}: {formatDate(profile.memberSince, i18n.language)}
              </Text>
              {(profile.telegram || profile.linkedin) && (
                <View style={styles.contactsRow}>
                  {profile.telegram && <Text style={styles.meta}>{profile.telegram}</Text>}
                  {profile.linkedin && <Text style={styles.meta}>{profile.linkedin}</Text>}
                </View>
              )}

              {profile.bio && (
                <View style={styles.bioBox}>
                  <RichTextView html={profile.bio} textStyle={styles.bio} color={colors.text} fontSize={14} />
                </View>
              )}

              {investedAmount != null && (
                <Text style={styles.investedLine}>
                  {t('project.investedHere')}: x{investedQuantity} · {investedAmount.toLocaleString()}{' '}
                  {t('common.currency')}
                </Text>
              )}

              <Text style={[styles.label, styles.sectionSpacing]}>{t('project.otherProjects')}</Text>
              {otherProjects.length === 0 ? (
                <Text style={styles.meta}>{t('project.noOtherProjects')}</Text>
              ) : (
                otherProjects.map((p) => (
                  <Text key={p.id} style={styles.projectRow}>
                    {getLocalizedText(p.title, i18n.language)}
                  </Text>
                ))
              )}

              <View style={{ height: spacing.md }} />
              <PrimaryButton title={t('common.close')} onPress={onClose} />
            </ScrollView>
          )}
      </View>
    </Dialog>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: spacing.lg,
      maxHeight: '80%',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerText: {
      flex: 1,
      marginLeft: spacing.md,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    name: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    adminBadge: {
      marginLeft: spacing.sm,
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    adminBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.primary,
    },
    verified: {
      fontSize: 12,
      fontWeight: '600',
      color: c.success,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    meta: {
      fontSize: 13,
      color: c.textMuted,
      marginRight: spacing.md,
    },
    contactsRow: {
      marginTop: spacing.xs,
    },
    bioBox: {
      marginTop: spacing.md,
    },
    bio: {
      fontSize: 14,
      color: c.text,
    },
    investedLine: {
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      marginTop: spacing.md,
    },
    label: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    sectionSpacing: {
      marginTop: spacing.md,
    },
    projectRow: {
      fontSize: 14,
      color: c.text,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
  });
