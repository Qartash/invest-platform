import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject } from '../../api/projects';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useThemeStyles } from '../../theme';
import { ProjectWorksPanel } from '../../components/ProjectWorksPanel';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

type Props = NativeStackScreenProps<FounderStackParamList, 'ProjectWorks'>;

export function ProjectWorksScreen({ route }: Props) {
  const styles = useThemeStyles(createStyles);
  const { projectId } = route.params;
  const { i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const [project, setProject] = useState<Project | null>(null);

  const load = useCallback(() => {
    fetchProject(projectId).then(setProject);
  }, [projectId]);

  useFocusEffect(load);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}>
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg },
    // As on the founder's finance screen: this is a work surface, not a read-only view.
    contentWide: { maxWidth: maxWidth.page, width: '100%', alignSelf: 'center' },
    title: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    panel: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
  });
