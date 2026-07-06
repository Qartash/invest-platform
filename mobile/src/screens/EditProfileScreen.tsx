import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { Avatar } from '../components/Avatar';
import { AvatarPickerModal } from '../components/AvatarPickerModal';
import { RichTextEditor } from '../components/RichTextEditor';
import { isRichTextEmpty } from '../utils/richText';
import { colors, spacing } from '../theme';
import { updateMe } from '../api/users';
import { useAuthStore } from '../store/authStore';
import { Gender } from '../types';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

const GENDERS: Gender[] = ['male', 'female', 'other'];

export function EditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '');
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [occupation, setOccupation] = useState(user?.occupation ?? '');
  const [linkedin, setLinkedin] = useState(user?.linkedin ?? '');
  const [shareContactsPublicly, setShareContactsPublicly] = useState(user?.shareContactsPublicly ?? false);
  const [loading, setLoading] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const updated = await updateMe({
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        telegram: telegram.trim() || undefined,
        birthDate: birthDate.trim() || undefined,
        gender: gender ?? undefined,
        bio: isRichTextEmpty(bio) ? undefined : bio.trim(),
        occupation: occupation.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        shareContactsPublicly,
      });
      updateUser(updated);
      navigation.goBack();
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Avatar avatarUrl={user?.avatarUrl} avatarEmoji={user?.avatarEmoji} size={88} />
        </View>
        <Pressable onPress={() => setAvatarModalVisible(true)}>
          <Text style={styles.photoButtonText}>
            {user?.avatarUrl || user?.avatarEmoji ? t('profile.changePhoto') : t('profile.addPhoto')}
          </Text>
        </Pressable>
      </View>

      <TextField label={t('auth.fullName')} value={fullName} onChangeText={setFullName} />
      <TextField label={t('profile.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label={t('profile.telegram')} value={telegram} onChangeText={setTelegram} autoCapitalize="none" />
      <TextField
        label={t('profile.birthDate')}
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder="YYYY-MM-DD"
        hint={t('common.dateFormatHint')}
        format="date"
      />

      <Text style={styles.label}>{t('profile.gender')}</Text>
      <View style={styles.genderRow}>
        {GENDERS.map((g) => (
          <Pressable
            key={g}
            style={[styles.genderChip, gender === g && styles.genderChipActive]}
            onPress={() => setGender(g)}
          >
            <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>
              {t(`profile.gender${g.charAt(0).toUpperCase()}${g.slice(1)}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>{t('profile.bio')}</Text>
      <RichTextEditor value={bio} onChangeText={setBio} placeholder={t('profile.bioPlaceholder')} />
      <TextField label={t('profile.occupation')} value={occupation} onChangeText={setOccupation} />
      <TextField label={t('profile.linkedin')} value={linkedin} onChangeText={setLinkedin} autoCapitalize="none" />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('profile.shareContactsPublicly')}</Text>
        <Switch value={shareContactsPublicly} onValueChange={setShareContactsPublicly} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton title={t('common.save')} onPress={handleSave} loading={loading} />

      <AvatarPickerModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        onUpdated={updateUser}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarWrap: {
    marginBottom: spacing.sm,
  },
  photoButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
    alignItems: 'center',
  },
  genderChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  genderChipTextActive: {
    color: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  switchLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    marginRight: spacing.sm,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
