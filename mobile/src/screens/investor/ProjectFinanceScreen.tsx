import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject, fetchProjectPurchases } from '../../api/projects';
import { fetchProjectFinancialReports } from '../../api/projectFinance';
import { Project, ProjectFinancialReport, ProjectPurchase } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing } from '../../theme';
import { ProjectFinancePanel } from '../../components/ProjectFinancePanel';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'ProjectFinance'>;

export function ProjectFinanceScreen({ route }: Props) {
  const { projectId } = route.params;
  const { t, i18n } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [project, setProject] = useState<Project | null>(null);
  const [purchases, setPurchases] = useState<ProjectPurchase[]>([]);
  const [reports, setReports] = useState<ProjectFinancialReport[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchProject(projectId).then(setProject);
      fetchProjectPurchases(projectId).then(setPurchases);
      fetchProjectFinancialReports(projectId).then(setReports);
    }, [projectId]),
  );

  const myPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.buyerId === currentUserId),
    [purchases, currentUserId],
  );
  const myTicketQuantity = myPurchases.reduce((total, purchase) => total + purchase.quantity, 0);
  const myInvested = myPurchases.reduce((total, purchase) => total + purchase.totalPrice, 0);
  const mySharePercent = project && project.totalTickets > 0 ? (myTicketQuantity / project.totalTickets) * 100 : 0;
  const myDividendsTotal = reports.reduce((sum, report) => sum + (report.myDividend ?? 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    color: 'rgba(255,255,255,0.85)',
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
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
