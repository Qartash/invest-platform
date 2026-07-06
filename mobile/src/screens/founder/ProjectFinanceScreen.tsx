import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject } from '../../api/projects';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { colors, spacing } from '../../theme';
import { ProjectFinancePanel } from '../../components/ProjectFinancePanel';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

type Props = NativeStackScreenProps<FounderStackParamList, 'ProjectFinance'>;

export function ProjectFinanceScreen({ route }: Props) {
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
        <ProjectFinancePanel projectId={projectId} canEdit ticketsSold={project?.ticketsSold ?? 0} />
      </View>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
