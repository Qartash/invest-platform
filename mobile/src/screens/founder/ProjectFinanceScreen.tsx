import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject } from '../../api/projects';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { spacing, ThemeColors, useThemeStyles } from '../../theme';
import { ProjectFinancePanel } from '../../components/ProjectFinancePanel';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

type Props = NativeStackScreenProps<FounderStackParamList, 'ProjectFinance'>;

export function ProjectFinanceScreen({ route }: Props) {
  const styles = useThemeStyles(createStyles);
  const { projectId } = route.params;
  const { i18n } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchProject(projectId).then(setProject);
    }, [projectId]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {project && <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>}
      <View style={styles.panel}>
        <ProjectFinancePanel
          projectId={projectId}
          canEdit
          ticketsSold={project?.ticketsSold ?? 0}
          totalTickets={project?.totalTickets ?? 0}
        />
      </View>
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
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    panel: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
  });
