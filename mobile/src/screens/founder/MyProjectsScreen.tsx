import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  cancelProjectDeletion,
  cancelProjectReview,
  fetchMyProjects,
  requestProjectDeletion,
  restoreProject,
} from '../../api/projects';
import { fetchPortfolio } from '../../api/portfolio';
import { cancelTicketListing, listTicketForSale } from '../../api/tickets';
import { Holding, PortfolioSummary, Project } from '../../types';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { useAuthStore } from '../../store/authStore';
import {
  maxWidth,
  radius,
  spacing,
  ThemeColors,
  typography,
  useBreakpoint,
  useTheme,
  useThemeStyles,
} from '../../theme';
import { Icon, PageContainer, SegmentedTabs, useGrid } from '../../components/ui';
import { ProjectHistoryModal } from '../../components/ProjectHistoryModal';
import { OwnedProjectCard } from '../../components/OwnedProjectCard';
import { HoldingCard } from '../../components/HoldingCard';
import { PortfolioSummaryCard } from '../../components/PortfolioSummaryCard';
import { SellTicketModal } from '../../components/SellTicketModal';
import { FounderStackParamList } from '../../navigation/FounderNavigator';

type Tab = 'owned' | 'invested';

type Props = NativeStackScreenProps<FounderStackParamList, 'MyProjects'>;

export function MyProjectsScreen({ navigation }: Props) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { isCompact } = useBreakpoint();
  const [tab, setTab] = useState<Tab>('owned');
  const [projects, setProjects] = useState<Project[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [listingHolding, setListingHolding] = useState<Holding | null>(null);
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Two abreast even at the widest window: an owned card carries a status, figures and up
  // to six actions, and a third column starts stacking those actions vertically.
  const { columns, data: ownedCells, isGrid } = useGrid(projects, { medium: 2, wide: 2 });

  // With no owned projects the "Invested" tab is the useful one, so default to
  // it (and show it first) — but only until the user taps a tab themselves.
  const tabTouched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, portfolio] = await Promise.all([fetchMyProjects(), fetchPortfolio()]);
      setProjects(projectsData);
      setHoldings(portfolio.holdings);
      setSummary(portfolio.summary);
      if (!tabTouched.current) {
        setTab(projectsData.length > 0 ? 'owned' : 'invested');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const selectTab = (next: Tab) => {
    tabTouched.current = true;
    setTab(next);
  };

  const tabOrder: Tab[] = projects.length > 0 ? ['owned', 'invested'] : ['invested', 'owned'];
  const tabCount = (key: Tab) => (key === 'owned' ? projects.length : holdings.length);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleConfirmListing = async (quantity: number, askingPrice: number) => {
    if (!listingHolding) return;
    setListingSubmitting(true);
    try {
      await listTicketForSale(listingHolding.ticketIds, quantity, askingPrice);
      showAlert(t('portfolio.listingSuccess'));
      setListingHolding(null);
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setListingSubmitting(false);
    }
  };

  const handleCancelListing = async (ticketId: string) => {
    setCancellingId(ticketId);
    try {
      await cancelTicketListing(ticketId);
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setCancellingId(null);
    }
  };

  const runAction = async (id: string, action: () => Promise<unknown>) => {
    setActingId(id);
    try {
      await action();
      await load();
    } catch (err: any) {
      showAlert(t('common.error'), apiErrorMessage(err, t));
    } finally {
      setActingId(null);
    }
  };

  const handleCreateProject = () => {
    if (user?.kycStatus !== 'approved') {
      showAlert(t('founder.verificationRequiredTitle'), t('founder.verificationRequiredMessage'));
      return;
    }
    navigation.navigate('CreateProject');
  };

  const openAsInvestor = (projectId: string) =>
    navigation
      .getParent()
      ?.navigate('HomeTab', { screen: 'ProjectDetail', params: { projectId } } as never);

  const handleDeleteProject = (item: Project) => {
    showAlert(
      t('founder.deleteConfirmTitle'),
      item.ticketsSold > 0 ? t('founder.deleteConfirmMessageWithInvestors') : t('founder.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('founder.deleteConfirmAction'),
          style: 'destructive',
          onPress: () => runAction(item.id, () => requestProjectDeletion(item.id)),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* The head is capped to whatever the tab below it is capped to, so the title never
          hangs off the left edge of its own list. */}
      <PageContainer maxWidth={tab === 'owned' ? maxWidth.page : maxWidth.column}>
        <View style={styles.head}>
          <Text style={styles.header}>{t('founder.myProjects')}</Text>
          <SegmentedTabs
            active={tab}
            onChange={selectTab}
            variant="track"
            tabs={tabOrder.map((key) => ({
              key,
              label: t(key === 'owned' ? 'founder.tabOwned' : 'founder.tabInvested'),
              count: tabCount(key),
            }))}
          />
        </View>
      </PageContainer>

      {tab === 'owned' && (
        <FlatList
          key={columns}
          numColumns={columns}
          columnWrapperStyle={isGrid ? styles.row : undefined}
          data={ownedCells}
          keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
          contentContainerStyle={[styles.list, !isCompact && styles.listWide]}
          renderItem={({ item }) => {
            if (isGrid) {
              return (
                <View style={styles.cell}>
                  {item && (
                    <OwnedProjectCard
                      project={item}
                      busy={actingId === item.id}
                      onOpenFinance={() => navigation.navigate('ProjectFinance', { projectId: item.id })}
                      onOpenWorks={() => navigation.navigate('ProjectWorks', { projectId: item.id })}
                      onOpenHistory={() => setHistoryProjectId(item.id)}
                      onEdit={() => navigation.navigate('CreateProject', { projectId: item.id })}
                      onPreview={() => openAsInvestor(item.id)}
                      onDelete={() => handleDeleteProject(item)}
                      onCancelReview={() => runAction(item.id, () => cancelProjectReview(item.id))}
                      onCancelDeletion={() => runAction(item.id, () => cancelProjectDeletion(item.id))}
                      onRestore={() => runAction(item.id, () => restoreProject(item.id))}
                    />
                  )}
                </View>
              );
            }
            return item ? (
              <OwnedProjectCard
                project={item}
                busy={actingId === item.id}
                onOpenFinance={() => navigation.navigate('ProjectFinance', { projectId: item.id })}
                onOpenWorks={() => navigation.navigate('ProjectWorks', { projectId: item.id })}
                onOpenHistory={() => setHistoryProjectId(item.id)}
                onEdit={() => navigation.navigate('CreateProject', { projectId: item.id })}
                onPreview={() => openAsInvestor(item.id)}
                onDelete={() => handleDeleteProject(item)}
                onCancelReview={() => runAction(item.id, () => cancelProjectReview(item.id))}
                onCancelDeletion={() => runAction(item.id, () => cancelProjectDeletion(item.id))}
                onRestore={() => runAction(item.id, () => restoreProject(item.id))}
              />
            ) : null;
          }}
          ListFooterComponent={
            <Pressable
              onPress={handleCreateProject}
              style={({ pressed }) => [styles.createCard, pressed && styles.pressed]}
            >
              <Icon name="plus" size={20} color={colors.primary} />
              <Text style={styles.createTitle}>{t('founder.createProject')}</Text>
              {user?.kycStatus !== 'approved' && (
                <Text style={styles.createNote}>{t('founder.verificationRequiredShort')}</Text>
              )}
            </Pressable>
          }
        />
      )}

      {tab === 'invested' && (
        <FlatList
          data={holdings}
          keyExtractor={(item) => item.ticketId}
          contentContainerStyle={[styles.list, !isCompact && styles.investedWide]}
          ListHeaderComponent={summary && holdings.length > 0 ? <PortfolioSummaryCard summary={summary} /> : null}
          renderItem={({ item }) => (
            <HoldingCard
              holding={item}
              onPressTitle={() => openAsInvestor(item.projectId)}
              onSellPress={setListingHolding}
              onCancelListing={handleCancelListing}
              cancellingId={cancellingId}
            />
          )}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('portfolio.noHoldings')}</Text> : null}
        />
      )}

      {historyProjectId && (
        <ProjectHistoryModal
          visible={!!historyProjectId}
          projectId={historyProjectId}
          onClose={() => setHistoryProjectId(null)}
        />
      )}

      <SellTicketModal
        holding={listingHolding}
        submitting={listingSubmitting}
        onClose={() => setListingHolding(null)}
        onConfirm={handleConfirmListing}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    // The tab control still needs an opaque ground — the list scrolls beneath it. The rule
    // that used to sit under it is gone: the track's groove is the edge now.
    head: {
      backgroundColor: c.background,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    header: {
      ...typography.display,
      color: c.text,
      marginBottom: spacing.sm + 2,
    },
    list: {
      padding: spacing.md,
    },
    listWide: {
      maxWidth: maxWidth.page,
      width: '100%',
      alignSelf: 'center',
    },
    // Holdings stay a single column for the same reason as on the portfolio screen: each
    // row is a label paired with a figure, and width is what breaks the pairing.
    investedWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },
    row: {
      gap: spacing.md,
    },
    cell: {
      flex: 1,
    },
    pressed: {
      opacity: 0.7,
    },
    createCard: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.border,
    },
    createTitle: {
      ...typography.bodyStrong,
      color: c.text,
    },
    createNote: {
      ...typography.micro,
      color: c.textMuted,
      textAlign: 'center',
    },
    empty: {
      ...typography.body,
      textAlign: 'center',
      color: c.textMuted,
      marginTop: spacing.xl,
    },
  });
