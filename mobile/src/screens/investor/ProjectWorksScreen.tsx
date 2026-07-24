import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject } from '../../api/projects';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { useAuthStore } from '../../store/authStore';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useThemeStyles } from '../../theme';
import { ProjectWorksPanel } from '../../components/ProjectWorksPanel';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'ProjectWorks'>;

export function ProjectWorksScreen({ route }: Props) {
  const styles = useThemeStyles(createStyles);
  const { projectId } = route.params;
  const { i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [project, setProject] = useState<Project | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchProject(projectId).then(setProject);
    }, [projectId]),
  );

  const isFounder = !!project && project.founderId === currentUserId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}>
      {project && <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>}
      <View style={styles.panel}>
        <ProjectWorksPanel
          projectId={projectId}
          canEdit={isFounder}
          currentUserId={currentUserId}
          // Pass the treasury balances so the founder gets the same funds
          // pre-check here as on the founder screen (checked against the
          // applicant's offered price, not the work's original price).
          treasuryBalance={isFounder && project ? parseFloat(project.treasuryBalance ?? '0') : undefined}
          spendableBalance={isFounder && project ? parseFloat(project.spendableBalance ?? '0') : undefined}
          onChanged={() => fetchProject(projectId).then(setProject)}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg },
    contentWide: { maxWidth: maxWidth.column, width: '100%', alignSelf: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    panel: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
  });
