import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Project } from '../types';
import { formatDateTime } from '../utils/date';
import { spacing, ThemeColors, useTheme, useThemeStyles } from '../theme';
import { PrimaryButton } from './PrimaryButton';
import { InvestorProfileModal } from './InvestorProfileModal';
import { RichTextView } from './RichTextView';

interface Props {
  visible: boolean;
  project: Project;
  onClose: () => void;
}

export function RiskLevelModal({ visible, project, onClose }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [showModeratorProfile, setShowModeratorProfile] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('project.riskInfoTitle')}</Text>
          <Text style={styles.badge}>{t(`project.risk.${project.riskLevel}`)}</Text>
          <Text style={styles.label}>{t('project.riskReasonLabel')}</Text>
          {project.riskReason ? (
            <RichTextView html={project.riskReason} textStyle={styles.reasonText} color={colors.text} fontSize={15} />
          ) : (
            <Text style={styles.reasonText}>{t('project.riskNoReason')}</Text>
          )}
          {project.riskReason && project.riskSetAt && (
            <Pressable disabled={!project.riskSetByUserId} onPress={() => setShowModeratorProfile(true)}>
              <Text style={[styles.meta, project.riskSetByUserId && styles.metaLink]}>
                {t('project.riskSetBy', {
                  name: project.riskSetByName,
                  date: formatDateTime(project.riskSetAt, i18n.language),
                })}
              </Text>
            </Pressable>
          )}
          <View style={{ height: spacing.md }} />
          <PrimaryButton title={t('common.close')} onPress={onClose} />
        </View>
      </View>

      <InvestorProfileModal
        visible={showModeratorProfile}
        investorId={project.riskSetByUserId ?? null}
        onClose={() => setShowModeratorProfile(false)}
      />
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    label: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
      marginBottom: spacing.md,
    },
    reasonText: {
      fontSize: 15,
      color: c.text,
      marginBottom: spacing.sm,
    },
    meta: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: spacing.xs,
    },
    metaLink: {
      color: c.primary,
      textDecorationLine: 'underline',
    },
  });
