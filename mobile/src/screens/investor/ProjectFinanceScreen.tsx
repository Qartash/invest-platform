import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject, fetchProjectPurchases } from '../../api/projects';
import { fetchProjectFinancialReports } from '../../api/projectFinance';
import { useCachedQuery } from '../../api/useCachedQuery';
import { Project, ProjectFinancialReport, ProjectPurchase } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { useAuthStore } from '../../store/authStore';
import { maxWidth, spacing, ThemeColors, useBreakpoint, useTheme, useThemeStyles } from '../../theme';
import { ProjectFinancePanel } from '../../components/ProjectFinancePanel';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'ProjectFinance'>;

export function ProjectFinanceScreen({ route }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { projectId } = route.params;
  const { t, i18n } = useTranslation();
  const { isCompact } = useBreakpoint();
  const currentUserId = useAuthStore((s) => s.user?.id);
  // The first two share their keys with the project screen this is usually opened from.
  const { data: project } = useCachedQuery<Project>(
    `projects:one:${projectId}`,
    useCallback(() => fetchProject(projectId), [projectId]),
  );
  const { data: fetchedPurchases } = useCachedQuery<ProjectPurchase[]>(
    `projects:one:${projectId}:purchases`,
    useCallback(() => fetchProjectPurchases(projectId), [projectId]),
  );
  const { data: fetchedReports } = useCachedQuery<ProjectFinancialReport[]>(
    `projects:one:${projectId}:reports`,
    useCallback(() => fetchProjectFinancialReports(projectId), [projectId]),
  );

  const purchases = useMemo(() => fetchedPurchases ?? [], [fetchedPurchases]);
  const reports = useMemo(() => fetchedReports ?? [], [fetchedReports]);

  const myPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.buyerId === currentUserId),
    [purchases, currentUserId],
  );
  const myTicketQuantity = myPurchases.reduce((total, purchase) => total + purchase.quantity, 0);
  const myInvested = myPurchases.reduce((total, purchase) => total + purchase.totalPrice, 0);
  const mySharePercent = project && project.totalTickets > 0 ? (myTicketQuantity / project.totalTickets) * 100 : 0;
  const myDividendsTotal = reports.reduce((sum, report) => sum + (report.myDividend ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, !isCompact && styles.contentWide]}>
      {project && <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>}

      {myTicketQuantity > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('project.finance.mySummaryTitle')}</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>{t('project.finance.myInvested')}</Text>
              <Text style={styles.summaryValue}>
                {myInvested.toLocaleString()} {t('common.currency')}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>{t('project.finance.myShareOfProject')}</Text>
              <Text style={styles.summaryValue}>
                {myTicketQuantity} · {mySharePercent.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>{t('project.finance.myDividendsTotal')}</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                +{myDividendsTotal.toLocaleString()} {t('common.currency')}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <ProjectFinancePanel
          projectId={projectId}
          canEdit={false}
          ticketsSold={project?.ticketsSold ?? 0}
          totalTickets={project?.totalTickets ?? 0}
          myTicketQuantity={myTicketQuantity}
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
    contentWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      marginBottom: spacing.md,
    },
    summaryCard: {
      backgroundColor: c.primary,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    summaryTitle: {
      color: c.textOnAccentMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    summaryCell: {
      minWidth: '33%',
      flexGrow: 1,
      marginBottom: spacing.xs,
    },
    summaryLabel: {
      color: c.textOnAccentMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    summaryValue: {
      color: c.textOnAccent,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    panel: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
  });
