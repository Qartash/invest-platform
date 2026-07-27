import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject } from '../../api/projects';
import { useCachedQuery } from '../../api/useCachedQuery';
import { Project } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useThemeStyles } from '../../theme';
import { ProjectFinancePanel } from '../../components/ProjectFinancePanel';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

type Props = NativeStackScreenProps<FounderStackParamList, 'ProjectFinance'>;

export function ProjectFinanceScreen({ route }: Props) {
  const styles = useThemeStyles(createStyles);
  const { projectId } = route.params;
  const { i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  // Shares the project's key with every other screen that shows it, so coming back from the
  // list does not refetch what was just displayed.
  const { data: project } = useCachedQuery<Project>(
    `projects:one:${projectId}`,
    useCallback(() => fetchProject(projectId), [projectId]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}>
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
    // Wider than the investor's read-only view of the same panel: this is the screen the
    // founder enters months of income and expenses on, and the entry rows are what the
    // extra width buys.
    contentWide: {
      maxWidth: maxWidth.page,
      width: '100%',
      alignSelf: 'center',
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
