import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject } from '../../api/projects';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { colors, spacing } from '../../theme';
import { ProjectWorksPanel } from '../../components/ProjectWorksPanel';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

type Props = NativeStackScreenProps<FounderStackParamList, 'ProjectWorks'>;

export function ProjectWorksScreen({ route }: Props) {
  const { projectId } = route.params;
  const { i18n } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);

  const load = useCallback(() => {
    fetchProject(projectId).then(setProject);
  }, [projectId]);

  useFocusEffect(load);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {project && <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>}
      <View style={styles.panel}>
        <ProjectWorksPanel
          projectId={projectId}
          canEdit
          treasuryBalance={project ? parseFloat(project.treasuryBalance ?? '0') : 0}
          spendableBalance={project ? parseFloat(project.spendableBalance ?? '0') : 0}
          onChanged={load}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
