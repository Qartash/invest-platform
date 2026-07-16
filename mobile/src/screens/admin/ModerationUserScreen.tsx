import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { adminUpdateUser, banUser, deleteUser, fetchAllUsers, restoreUser, unbanUser } from '../../api/users';
import { AuthUser, KycStatus, UserRole } from '../../types';
import { Avatar } from '../../components/Avatar';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { showAlert } from '../../utils/alert';
import { formatDate } from '../../utils/date';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';
import { ModerationStackParamList } from '../../navigation/ModerationNavigator';

type Props = NativeStackScreenProps<ModerationStackParamList, 'ModerationUser'>;

const ROLES: UserRole[] = ['investor', 'founder', 'admin'];
const KYC_STATUSES: KycStatus[] = ['none', 'pending', 'approved', 'rejected'];

export function ModerationUserScreen({ route, navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { userId } = route.params;
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('investor');
  const [kycStatus, setKycStatus] = useState<KycStatus>('none');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    // No single-user admin endpoint yet; the list is small and already cached
    // server-side, so pick the user out of /users/all.
    fetchAllUsers().then((users) => {
      const found = users.find((u) => u.id === userId);
      if (!found) return;
      setUser(found);
      setFullName(found.fullName ?? '');
      setUsername(found.username ?? '');
      setEmail(found.email ?? '');
      setPhone(found.phone ?? '');
      setRole(found.role);
      setKycStatus(found.kycStatus);
    });
  }, [userId]);

  useFocusEffect(load);

  const handleError = (err: any) => showAlert(t('common.error'), err?.response?.data?.message ?? undefined);

  const handleSave = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const updated = await adminUpdateUser(user.id, {
        fullName: fullName.trim() || undefined,
        username: username.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        kycStatus,
        password: password.trim() || undefined,
      });
      setUser(updated);
      setPassword('');
      showAlert(t('moderation.users.saved'));
    } catch (err: any) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBanToggle = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      setUser(user.bannedAt ? await unbanUser(user.id) : await banUser(user.id));
    } catch (err: any) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!user) return;
    if (user.deletedAt) {
      restoreUser(user.id).then(setUser).catch(handleError);
      return;
    }
    showAlert(t('moderation.users.deleteConfirmTitle'), t('moderation.users.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteUser(user.id)
            .then((updated) => {
              setUser(updated);
              navigation.goBack();
            })
            .catch(handleError);
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Avatar avatarUrl={user.avatarUrl} avatarEmoji={user.avatarEmoji} size={56} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{user.fullName || user.username || '—'}</Text>
          <Text style={styles.meta}>
            {user.createdAt ? `${t('profile.memberSince')}: ${formatDate(user.createdAt, i18n.language)}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {user.bannedAt && (
          <View style={[styles.badge, styles.badgeDanger]}>
            <Text style={styles.badgeDangerText}>{t('moderation.users.bannedBadge')}</Text>
          </View>
        )}
        {user.deletedAt && (
          <View style={[styles.badge, styles.badgeDanger]}>
            <Text style={styles.badgeDangerText}>{t('project.status.deleted')}</Text>
          </View>
        )}
      </View>

      <TextField label={t('auth.fullName')} value={fullName} onChangeText={setFullName} />
      <TextField
        label={t('auth.username')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <TextField label={t('profile.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.sectionLabel}>{t('moderation.users.role')}</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => (
          <Pressable key={r} style={[styles.roleChip, role === r && styles.roleChipActive]} onPress={() => setRole(r)}>
            <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
              {t(`moderation.users.roles.${r}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t('moderation.users.kycStatus')}</Text>
      <View style={styles.kycRow}>
        {KYC_STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[styles.roleChip, kycStatus === s && styles.roleChipActive]}
            onPress={() => setKycStatus(s)}
          >
            <Text style={[styles.roleChipText, kycStatus === s && styles.roleChipTextActive]}>
              {t(`profile.kyc.${s}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.kycHint}>{t('moderation.users.kycHint')}</Text>

      <TextField
        label={t('moderation.users.newPassword')}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder={t('moderation.users.newPasswordPlaceholder')}
      />

      <PrimaryButton title={t('common.save')} onPress={handleSave} loading={submitting} />

      <Pressable style={[styles.actionButton, styles.banButton]} onPress={handleBanToggle} disabled={submitting}>
        <Text style={styles.banButtonText}>
          {user.bannedAt ? t('moderation.users.unban') : t('moderation.users.ban')}
        </Text>
      </Pressable>

      <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete} disabled={submitting}>
        <Text style={styles.deleteButtonText}>
          {user.deletedAt ? t('moderation.users.restore') : t('moderation.users.delete')}
        </Text>
      </Pressable>
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
      padding: spacing.lg,
      paddingBottom: spacing.xl,
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
    name: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    meta: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    badgeRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      marginRight: spacing.xs,
    },
    badgeDanger: {
      borderColor: c.danger,
      backgroundColor: c.background,
    },
    badgeDangerText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.danger,
    },
    sectionLabel: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    roleRow: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    kycRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: spacing.xs,
      marginBottom: spacing.xs,
    },
    kycHint: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: spacing.md,
    },
    roleChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      marginRight: spacing.sm,
      backgroundColor: c.surface,
    },
    roleChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primary,
    },
    roleChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textMuted,
    },
    roleChipTextActive: {
      color: c.surface,
    },
    actionButton: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    banButton: {
      borderColor: c.warning,
    },
    banButtonText: {
      color: c.warning,
      fontWeight: '700',
    },
    deleteButton: {
      borderColor: c.danger,
    },
    deleteButtonText: {
      color: c.danger,
      fontWeight: '700',
    },
  });
