import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutChangeEvent,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  fetchProject,
  fetchProjectPurchases,
  fetchProjectListings,
  fetchProjectAttachments,
  fetchProjectTeam,
} from '../../api/projects';
import { buyTicket, buyListing } from '../../api/tickets';
import { invalidateQuery, useCachedQuery } from '../../api/useCachedQuery';
import { fetchWallet } from '../../api/wallet';
import { resolveMediaUrl } from '../../api/client';
import {
  Project,
  ProjectAttachment,
  ProjectPurchase,
  ProjectTeamMember,
  TicketListing,
  Wallet,
} from '../../types';
import { getLocalizedText } from '../../utils/localized';
import {
  computeMaxAffordableTickets,
  computeTicketPurchaseCost,
  equityForTickets,
  equityPerTicket,
  impliedValuation,
} from '../../utils/pricing';
import { formatDate, formatDateTime } from '../../utils/date';
import { showAlert } from '../../utils/alert';
import { apiErrorMessage } from '../../utils/apiError';
import { useAuthStore } from '../../store/authStore';
import {
  maxWidth,
  radius,
  spacing,
  tabularNums,
  ThemeColors,
  typography,
  useBreakpoint,
  useTheme,
  useThemeStyles,
} from '../../theme';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TicketPriceChart } from '../../components/TicketPriceChart';
import { RiskLevelModal } from '../../components/RiskLevelModal';
import { InvestorsListModal, InvestorSummary } from '../../components/InvestorsListModal';
import { InvestorProfileModal } from '../../components/InvestorProfileModal';
import { HintModal } from '../../components/HintModal';
import { RichTextView } from '../../components/RichTextView';
import { BuyListingModal } from '../../components/BuyListingModal';
import { RoundLadder } from '../../components/RoundLadder';
import { TeamMemberCard } from '../../components/TeamMemberCard';
import { Card, HeroScrim, Icon, ListGroup, ListRow, Pill, SectionHeader, SegmentedTabs } from '../../components/ui';
import { ProjectQuestionsPanel } from '../../components/ProjectQuestionsPanel';
import { ProjectUpdatesPanel } from '../../components/ProjectUpdatesPanel';
import { HelpButton, TourTarget } from '../../onboarding';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

// Raw DOM tag — real YouTube embed on web; native shows an "open in YouTube" link instead.
const HtmlIframe: any = 'iframe';

// Index of the tab bar among the ScrollView's direct children — it is pinned so the user
// can switch sections from anywhere in a long panel.
const STICKY_TABS_INDEX = 2;

// How far the funding card rides up over the cover. The hero's own bottom padding has to
// clear it, or the card lands on top of the founder line.
const FUNDING_CARD_OVERLAP = 20;

// The tab bar is sticky, so a scroll that lands exactly on the resale header would park it
// underneath. This is roughly the bar's height plus a breath of air above the section.
const STICKY_TABS_CLEARANCE = 64;

type TabKey = 'about' | 'updates' | 'questions' | 'team' | 'market' | 'activity';

function extractYoutubeVideoId(url: string): string | null {
  const match = url.trim().match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Plain DOM style object (not StyleSheet.create) since this styles a raw <iframe>.
const youtubeIframeStyle: any = {
  width: '100%',
  aspectRatio: '16 / 9',
  border: 'none',
  borderRadius: 12,
};

type Props = NativeStackScreenProps<InvestorHomeStackParamList, 'ProjectDetail'>;

interface BuyerGroup {
  buyerId: string;
  buyerName: string;
  purchases: ProjectPurchase[];
  lastPurchaseDate: string;
}

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { isCompact } = useBreakpoint();
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Six requests used to go out every single time this screen came into focus, which is what
  // made stepping back from a sub-screen feel like opening the project from scratch. All six
  // sit under the `projects:` prefix (the wallet under `wallet:`), so the invalidations
  // already written for buying retire them exactly as before.
  const projectQuery = useCachedQuery<Project>(
    `projects:one:${projectId}`,
    useCallback(() => fetchProject(projectId), [projectId]),
  );
  const purchasesQuery = useCachedQuery<ProjectPurchase[]>(
    `projects:one:${projectId}:purchases`,
    useCallback(() => fetchProjectPurchases(projectId), [projectId]),
  );
  const listingsQuery = useCachedQuery<TicketListing[]>(
    `projects:one:${projectId}:listings`,
    useCallback(() => fetchProjectListings(projectId), [projectId]),
  );
  const attachmentsQuery = useCachedQuery<ProjectAttachment[]>(
    `projects:one:${projectId}:attachments`,
    useCallback(() => fetchProjectAttachments(projectId), [projectId]),
  );
  const teamQuery = useCachedQuery<ProjectTeamMember[]>(
    `projects:one:${projectId}:team`,
    useCallback(() => fetchProjectTeam(projectId), [projectId]),
  );
  const walletQuery = useCachedQuery<Wallet>('wallet:balance', fetchWallet);

  const project = projectQuery.data;
  const purchases = purchasesQuery.data ?? [];
  const listings = listingsQuery.data ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const team = teamQuery.data ?? [];
  const wallet = walletQuery.data;
  const [tab, setTab] = useState<TabKey>(route.params.openTab ?? 'about');
  const [quantity, setQuantity] = useState('1');
  const [forecastOpen, setForecastOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyingListing, setBuyingListing] = useState<TicketListing | null>(null);
  const [buyingListingSubmitting, setBuyingListingSubmitting] = useState(false);
  const [riskModalVisible, setRiskModalVisible] = useState(false);
  const [investorsModalVisible, setInvestorsModalVisible] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ title: string; description: string } | null>(null);

  const showHint = (title: string, description: string) => setHint({ title, description });

  // Resale lives on the Market tab, so reaching it is a tab switch *and* a scroll — landing
  // on the tab alone drops the user at the price chart with no sign of what they tapped for.
  const scrollRef = useRef<ScrollView>(null);
  const marketPanelY = useRef(0);
  const resaleSectionY = useRef(0);
  // Set when the tap happened on another tab: the market panel has not been laid out yet, so
  // the scroll has to wait for the resale block's onLayout to report where it landed.
  const [resaleScrollPending, setResaleScrollPending] = useState(false);
  const resaleFlash = useRef(new Animated.Value(0)).current;

  const revealResale = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, marketPanelY.current + resaleSectionY.current - STICKY_TABS_CLEARANCE),
      animated: true,
    });
    // Two pulses: enough to catch the eye at the end of the scroll without turning into a
    // blinking banner the user has to wait out.
    resaleFlash.setValue(0);
    Animated.sequence([
      Animated.delay(220),
      Animated.timing(resaleFlash, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.timing(resaleFlash, { toValue: 0, duration: 260, useNativeDriver: false }),
      Animated.timing(resaleFlash, { toValue: 1, duration: 260, useNativeDriver: false }),
      Animated.timing(resaleFlash, { toValue: 0, duration: 420, useNativeDriver: false }),
    ]).start();
  }, [resaleFlash]);

  const goToResale = () => {
    if (tab === 'market') {
      revealResale();
    } else {
      setTab('market');
      setResaleScrollPending(true);
    }
  };

  // The resale block reports its offset inside the panel, the panel its offset inside the
  // scroll content; the target is their sum. The pending scroll is consumed on the panel's
  // event rather than the block's because layout propagates bottom-up — by the time the
  // parent reports, both halves of the sum are known.
  const handleResaleLayout = (event: LayoutChangeEvent) => {
    resaleSectionY.current = event.nativeEvent.layout.y;
  };

  const handleMarketPanelLayout = (event: LayoutChangeEvent) => {
    marketPanelY.current = event.nativeEvent.layout.y;
    if (resaleScrollPending) {
      setResaleScrollPending(false);
      revealResale();
    }
  };

  // Everything the screen shows, refetched regardless of age. For after a purchase, where
  // the figures on screen are the ones that just changed.
  const load = useCallback(() => {
    void projectQuery.refresh();
    void purchasesQuery.refresh();
    void listingsQuery.refresh();
    void attachmentsQuery.refresh();
    void teamQuery.refresh();
    void walletQuery.refresh();
  }, [
    projectQuery.refresh,
    purchasesQuery.refresh,
    listingsQuery.refresh,
    attachmentsQuery.refresh,
    teamQuery.refresh,
    walletQuery.refresh,
  ]);

  useEffect(() => {
    if (route.params.scrollToResale) {
      setTab('market');
      setResaleScrollPending(true);
    }
  }, [route.params.scrollToResale]);

  const buyerGroups = useMemo<BuyerGroup[]>(() => {
    const groups = new Map<string, BuyerGroup>();
    for (const purchase of purchases) {
      const existing = groups.get(purchase.buyerId);
      if (existing) {
        existing.purchases.push(purchase);
        if (purchase.purchaseDate > existing.lastPurchaseDate) {
          existing.lastPurchaseDate = purchase.purchaseDate;
        }
      } else {
        groups.set(purchase.buyerId, {
          buyerId: purchase.buyerId,
          buyerName: purchase.buyerName,
          purchases: [purchase],
          lastPurchaseDate: purchase.purchaseDate,
        });
      }
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        purchases: [...group.purchases].sort((a, b) => (a.purchaseDate < b.purchaseDate ? 1 : -1)),
      }))
      .sort((a, b) => (a.lastPurchaseDate < b.lastPurchaseDate ? 1 : -1));
  }, [purchases]);

  // Primary purchases only: these are the ones bought from the project at a round price,
  // so they're the only ones whose price belongs on the round price history. A resale is
  // priced by whatever two investors agreed on and would otherwise drag the chart's scale
  // far off the ladder.
  const primaryPurchases = useMemo(() => purchases.filter((p) => !p.isResale), [purchases]);

  const investorSummaries = useMemo<InvestorSummary[]>(
    () =>
      buyerGroups.map((group) => ({
        buyerId: group.buyerId,
        buyerName: group.buyerName,
        quantity: group.purchases.reduce((sum, p) => sum + p.quantity, 0),
        amount: group.purchases.reduce((sum, p) => sum + p.totalPrice, 0),
      })),
    [buyerGroups],
  );

  const selectedInvestorSummary = investorSummaries.find((s) => s.buyerId === selectedInvestorId);

  if (!project) return null;

  const { pricing } = project;
  const currentPrice = pricing.currentTicketPrice;
  // Clamped at zero: an edit that dropped totalTickets below what had sold used to
  // make this negative and the card read "tickets left −50 / 50". The backend now
  // refuses such an edit, but a project written before that guard existed can still
  // be loaded, and the arithmetic here should not be what surfaces it.
  const ticketsLeft = Math.max(0, project.totalTickets - project.ticketsSold);
  // The raise is over on all three, and nothing about it should still be offered.
  const isRaising = project.status === 'active' || project.status === 'pending_review';
  const hasActiveListings = project.resaleEnabled && (project.resaleTicketsCount ?? 0) > 0;
  const worksCount = project.worksCount ?? 0;
  const collected = parseFloat(project.collectedAmount);
  const target = parseFloat(project.targetAmount);
  const fundingProgress = target > 0 ? Math.min(collected / target, 1) : 0;
  const parsedQuantity = Math.max(0, parseInt(quantity, 10) || 0);
  const totalCost = computeTicketPurchaseCost(pricing.tiers, project.ticketsSold, parsedQuantity);

  // Mirrors what tickets.service.ts actually spends on a purchase: invest credit first,
  // then the withdrawable balance. Anything less here would under-report what the user
  // can buy; anything more would offer a quantity the backend rejects.
  const spendable = wallet ? parseFloat(wallet.balance) + parseFloat(wallet.investCredit ?? '0') : null;
  const maxAffordable =
    spendable === null ? 0 : computeMaxAffordableTickets(pricing.tiers, project.ticketsSold, spendable, ticketsLeft);

  const equityOffered = parseFloat(project.equityOfferedPercent ?? '100');
  const equityRetained = Math.max(0, 100 - equityOffered);
  const valuation = impliedValuation(target, equityOffered);
  const perTicketEquity = equityPerTicket(equityOffered, project.totalTickets);
  const purchaseEquity = equityForTickets(equityOffered, project.totalTickets, parsedQuantity);
  const percent = (value: number, digits = 2) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: digits })}%`;

  const annualReturnRate = parseFloat(project.expectedAnnualReturnPercent) / 100;
  const expectedDailyProfit = (totalCost * annualReturnRate) / 365;
  const expectedMonthlyProfit = expectedDailyProfit * 30;
  const paybackDays = annualReturnRate > 0 ? Math.round(36500 / parseFloat(project.expectedAnnualReturnPercent)) : 0;

  const chartPoints =
    primaryPurchases.length > 0
      ? primaryPurchases.map((p) => ({
          unitPrice: p.unitPrice,
          quantity: p.quantity,
          totalPrice: p.totalPrice,
          buyerName: p.buyerName,
          date: p.purchaseDate,
        }))
      : pricing.tiers.map((tier) => ({ unitPrice: tier.price }));

  // How a resale price compares to buying the same ticket from the project right now. This is
  // the whole question a resale listing has to answer, and the asking price alone doesn't:
  // it's a lot sum, and the round price it should be judged against is elsewhere on the page.
  const resaleDelta = (unitPrice: number) =>
    currentPrice > 0 ? Math.round(((unitPrice - currentPrice) / currentPrice) * 100) : 0;
  const resaleDeltaLabel = (delta: number) =>
    delta === 0
      ? t('project.resaleSamePrice')
      : delta < 0
        ? t('project.resaleCheaper', { percent: Math.abs(delta) })
        : t('project.resaleCostlier', { percent: delta });
  const bestListingUnitPrice = listings.length > 0 ? Math.min(...listings.map((l) => l.unitPrice)) : null;

  const money = (value: number) => `${value.toLocaleString()} ${t('common.currency')}`;
  const roundedMoney = (value: number) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t('common.currency')}`;

  const setQuantityBy = (delta: number) => {
    const next = Math.min(Math.max(parsedQuantity + delta, 1), Math.max(ticketsLeft, 1));
    setQuantity(String(next));
  };

  const handleBuy = async () => {
    setBuying(true);
    try {
      await buyTicket(project.id, parsedQuantity);
      // Money left the wallet, a holding appeared, and the project's raise moved. All
      // three are cached on screens the user is about to go back to.
      invalidateQuery('wallet');
      invalidateQuery('portfolio');
      invalidateQuery('projects');
      showAlert(t('project.purchaseSuccess'));
      navigation.goBack();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      if (message === 'Insufficient wallet balance') {
        showAlert(t('project.insufficientFundsTitle'), t('project.insufficientFundsMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('wallet.deposit'),
            onPress: () => navigation.getParent()?.navigate('ProfileTab', { screen: 'Wallet' } as never),
          },
        ]);
      } else {
        showAlert(t('common.error'), apiErrorMessage(err, t));
      }
    } finally {
      setBuying(false);
    }
  };

  const handleBuyListing = async (quantity: number) => {
    if (!buyingListing) return;
    setBuyingListingSubmitting(true);
    try {
      await buyListing(buyingListing.id, quantity);
      invalidateQuery('wallet');
      invalidateQuery('portfolio');
      invalidateQuery('projects');
      showAlert(t('project.purchaseSuccess'));
      setBuyingListing(null);
      load();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      if (message === 'Insufficient wallet balance') {
        showAlert(t('project.insufficientFundsTitle'), t('project.insufficientFundsMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('wallet.deposit'),
            onPress: () => navigation.getParent()?.navigate('ProfileTab', { screen: 'Wallet' } as never),
          },
        ]);
      } else {
        showAlert(t('common.error'), apiErrorMessage(err, t));
      }
    } finally {
      setBuyingListingSubmitting(false);
    }
  };

  const videoId = project.youtubeUrl ? extractYoutubeVideoId(project.youtubeUrl) : null;

  const aboutPanel = (
    <View style={styles.panel}>
      <RichTextView html={getLocalizedText(project.description, i18n.language)} textStyle={styles.description} />

      {videoId &&
        (Platform.OS === 'web' ? (
          <View style={styles.youtubeWrapper}>
            <HtmlIframe src={`https://www.youtube.com/embed/${videoId}`} style={youtubeIframeStyle} allowFullScreen />
          </View>
        ) : (
          <Pressable style={styles.youtubeLinkButton} onPress={() => Linking.openURL(project.youtubeUrl!)}>
            <Text style={styles.youtubeLinkText}>▶  {t('project.watchOnYoutube')}</Text>
          </Pressable>
        ))}

      <SectionHeader title={t('project.metricsSection')} />
      <TourTarget id="project.metrics">
      <ListGroup>
        {project.riskLevel ? (
          <ListRow
            label={t('project.riskLevel')}
            right={
              <Pill
                label={t(`project.risk.${project.riskLevel}`)}
                tone={project.riskLevel === 'low' ? 'success' : project.riskLevel === 'high' ? 'danger' : 'warning'}
              />
            }
            onPress={() => setRiskModalVisible(true)}
          />
        ) : null}
        <ListRow
          label={t('project.investors')}
          value={project.investorCount ?? 0}
          onPress={investorSummaries.length > 0 ? () => setInvestorsModalVisible(true) : undefined}
        />
        <ListRow
          label={t('project.equityOffered')}
          value={percent(equityOffered)}
          onHintPress={() => showHint(t('project.equityOffered'), t('project.equityOfferedHint'))}
        />
        <ListRow label={t('project.equityRetained')} value={percent(equityRetained)} />
        <ListRow
          label={t('project.valuation')}
          value={roundedMoney(valuation)}
          onHintPress={() => showHint(t('project.valuation'), t('project.valuationHint'))}
        />
        <ListRow
          label={t('project.equityPerTicket')}
          value={percent(perTicketEquity, 4)}
          onHintPress={() => showHint(t('project.equityPerTicket'), t('project.equityPerTicketHint'))}
        />
        <ListRow label={t('project.annualReturn')} value={`${project.expectedAnnualReturnPercent}%`} />
        <ListRow
          label={t('home.started')}
          value={formatDate(project.createdAt, i18n.language)}
          onHintPress={() => showHint(t('home.started'), t('project.startedHint'))}
        />
        {project.deadline ? (
          <ListRow
            label={t('home.deadline')}
            value={formatDate(project.deadline, i18n.language)}
            onHintPress={() => showHint(t('home.deadline'), t('project.deadlineHint'))}
          />
        ) : null}
      </ListGroup>
      </TourTarget>

      {attachments.length > 0 && (
        <>
          <SectionHeader title={t('project.attachmentsTitle')} spaced />
          <ListGroup>
            {attachments.map((file) => (
              <ListRow
                key={file.id}
                icon="file"
                label={file.fileName}
                sublabel={formatFileSize(file.fileSize)}
                onPress={() => {
                  const url = resolveMediaUrl(file.fileUrl);
                  if (url) Linking.openURL(url);
                }}
              />
            ))}
          </ListGroup>
        </>
      )}

      <SectionHeader title={t('project.moreSection')} spaced />
      <TourTarget id="project.more">
      <ListGroup>
        <ListRow
          icon="chart"
          label={t('project.finance.title')}
          sublabel={t('project.financeSubtitle')}
          onPress={() => navigation.navigate('ProjectFinance', { projectId: project.id })}
        />
        <ListRow
          icon="wrench"
          label={t('works.title')}
          sublabel={t('project.worksSubtitle')}
          value={worksCount > 0 ? worksCount : undefined}
          onPress={() => navigation.navigate('ProjectWorks', { projectId: project.id })}
        />
      </ListGroup>
      </TourTarget>
    </View>
  );

  const teamPanel = (
    <View style={styles.panel}>
      {team.length === 0 ? (
        <Text style={styles.emptyNote}>{t('project.teamEmpty')}</Text>
      ) : (
        <>
          <Text style={styles.teamCaption}>{t('project.teamCaption')}</Text>
          {team.map((member) => (
            <TeamMemberCard
              key={member.id}
              name={member.name}
              role={member.role}
              bio={member.bio}
              photoUrl={member.photoUrl}
            />
          ))}
        </>
      )}
    </View>
  );

  const marketPanel = (
    <View style={styles.panel} onLayout={handleMarketPanelLayout}>
      <SectionHeader title={t('project.priceChart')} />
      <Card>
        <TicketPriceChart points={chartPoints} isProjected={purchases.length === 0} />
      </Card>

      <SectionHeader title={t('project.roundsSection')} spaced />
      <TourTarget id="project.rounds">
      <Pressable
        style={styles.roundBadgeRow}
        onPress={() =>
          showHint(
            t('project.currentRound', { current: pricing.currentTier + 1, total: pricing.totalTiers }),
            t('project.roundHint'),
          )
        }
      >
        <Text style={styles.roundBadge}>
          {t('project.currentRound', { current: pricing.currentTier + 1, total: pricing.totalTiers })}
        </Text>
        <Text style={styles.hintIconInline}>ⓘ</Text>
      </Pressable>
      {/* Sits directly on the page: its notches are painted in the background colour. */}
      <RoundLadder tiers={pricing.tiers} currentTier={pricing.currentTier} />
      </TourTarget>

      <View onLayout={handleResaleLayout}>
        <SectionHeader title={t('project.resaleSection')} spaced />
        <TourTarget id="project.resale">
        <Animated.View
          style={[
            styles.resaleHighlight,
            {
              borderColor: resaleFlash.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(0, 0, 0, 0)', colors.primary],
              }),
              backgroundColor: resaleFlash.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(0, 0, 0, 0)', colors.primarySoft],
              }),
            },
          ]}
        >
          {!project.resaleEnabled ? (
            <Text style={styles.emptyNote}>{t('project.resaleNotAllowed')}</Text>
          ) : (
            <>
              {hasActiveListings && (
                <Card accented style={styles.resaleBanner}>
                  <View style={styles.resalePlaque}>
                    <Icon name="refresh" color={colors.primary} size={17} />
                  </View>
                  <View style={styles.resaleBannerBody}>
                    <Text style={styles.resaleBannerTitle}>
                      {t('project.resaleBannerActive', { count: project.resaleTicketsCount })}
                    </Text>
                    {bestListingUnitPrice !== null && (
                      <Text style={styles.resaleBannerNote}>
                        {t('project.resaleFromPrice', { price: money(bestListingUnitPrice) })} ·{' '}
                        <Text style={resaleDelta(bestListingUnitPrice) <= 0 ? styles.deltaGood : styles.deltaBad}>
                          {resaleDeltaLabel(resaleDelta(bestListingUnitPrice))}
                        </Text>
                      </Text>
                    )}
                  </View>
                </Card>
              )}
              {listings.length === 0 ? (
                <Text style={styles.emptyNote}>{t('project.noListings')}</Text>
              ) : (
                listings.map((listing) => {
                  const isOwn = listing.sellerId === currentUserId;
                  const delta = resaleDelta(listing.unitPrice);
                  return (
                    <Card key={listing.id} accented={isOwn} style={styles.listingCard}>
                      <View style={styles.listingInfo}>
                        <View style={styles.listingSellerRow}>
                          <Text style={styles.listingSeller}>{listing.sellerName}</Text>
                          {isOwn && <Pill label={t('project.ownListing')} tone="primary" />}
                        </View>
                        <Text style={styles.listingMeta}>
                          ×{listing.quantity} · {money(listing.unitPrice)}/{t('project.perUnit')}
                        </Text>
                        <Text style={[styles.listingDelta, delta <= 0 ? styles.deltaGood : styles.deltaBad]}>
                          {resaleDeltaLabel(delta)}
                        </Text>
                      </View>
                      <View style={styles.listingAction}>
                        <Text style={styles.listingPrice}>{money(listing.askingPrice)}</Text>
                        {!isOwn && (
                          <PrimaryButton
                            title={t('project.buyListing')}
                            size="small"
                            variant="outline"
                            onPress={() => setBuyingListing(listing)}
                          />
                        )}
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </Animated.View>
        </TourTarget>
      </View>
    </View>
  );

  const activityPanel = (
    <View style={styles.panel}>
      <SectionHeader title={t('project.purchaseHistory')} />
      {buyerGroups.length === 0 ? (
        <Text style={styles.emptyNote}>{t('project.noPurchasesYet')}</Text>
      ) : (
        <>
          {buyerGroups.map((group) => {
            const summary = investorSummaries.find((s) => s.buyerId === group.buyerId);
            return (
              <Card key={group.buyerId} style={styles.buyerCard}>
                <Pressable style={styles.buyerHead} onPress={() => setSelectedInvestorId(group.buyerId)}>
                  <Text style={styles.buyerName} numberOfLines={1}>
                    {group.buyerName}
                  </Text>
                  <Text style={styles.buyerTotal}>{money(summary?.amount ?? 0)}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
                {group.purchases.map((purchase) => (
                  <View key={purchase.id} style={styles.purchaseRow}>
                    <View style={styles.purchaseInfo}>
                      <Text style={styles.purchaseMeta}>
                        ×{purchase.quantity} · {money(purchase.unitPrice)}/{t('project.perUnit')}
                      </Text>
                      <Text style={styles.purchaseDate}>{formatDateTime(purchase.purchaseDate, i18n.language)}</Text>
                    </View>
                    <Text style={styles.purchaseTotal}>{money(purchase.totalPrice)}</Text>
                  </View>
                ))}
              </Card>
            );
          })}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>
              {/* Straight from the project rather than summed over the holdings above:
                  a resold ticket carries the price its current owner paid the previous
                  one, so summing them would drift away from what the project raised the
                  moment anyone resells. */}
              {t('project.totalSold', {
                quantity: project.ticketsSold,
                amount: collected.toLocaleString(),
                currency: t('common.currency'),
              })}
            </Text>
          </View>
        </>
      )}
    </View>
  );

  const canBuy = parsedQuantity >= 1 && parsedQuantity <= ticketsLeft;
  const maxChipDisabled = maxAffordable < 1 || parsedQuantity === maxAffordable;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        // The buy block is the last thing on the page now, so the content itself has to clear
        // the home indicator — there is no pinned bar below it doing that any more.
        contentContainerStyle={[
          styles.content,
          !isCompact && styles.contentWide,
          { paddingBottom: spacing.lg + insets.bottom },
        ]}
        stickyHeaderIndices={[STICKY_TABS_INDEX]}
      >
        <View style={styles.hero}>
          {project.coverImageUrl ? (
            <Image source={{ uri: resolveMediaUrl(project.coverImageUrl) }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
          )}
          <HeroScrim />
          <Pressable
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            hitSlop={8}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          {/* Mirrors the back button across the hero. This is the densest page in the app —
              eight kinds of figure on one screen — so the way to ask what they mean belongs
              where the eye already is, not at the bottom of it. */}
          <View style={[styles.helpFloat, { top: insets.top + spacing.sm }]}>
            <HelpButton topic="project" tour="investor" />
          </View>
          <TourTarget id="project.hero" style={styles.heroBody}>
            <View style={styles.heroStatus}>
              <View style={styles.heroDot} />
              {/* Was hardcoded to "raising", so a sold-out project announced
                  "● RAISING · ROUND 4 OF 4" directly above "100% funded" and
                  "tickets left 0 / 100". The round only means anything while there
                  are rounds left to sell into. The founder's own list already got
                  this right, using the same project.status.* keys. */}
              <Text style={styles.heroStatusText}>
                {isRaising
                  ? `${t('project.statusRaising')} · ${t('project.currentRound', {
                      current: pricing.currentTier + 1,
                      total: pricing.totalTiers,
                    })}`
                  : t(`project.status.${project.status}`)}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{getLocalizedText(project.title, i18n.language)}</Text>
            {project.founderName && (
              <Pressable style={styles.heroFounder} onPress={() => setSelectedInvestorId(project.founderId)}>
                <Text style={styles.heroFounderText}>
                  {t('project.by')} {project.founderName} ›
                </Text>
              </Pressable>
            )}
          </TourTarget>
        </View>

        <TourTarget id="project.price" style={styles.fundingWrap}>
          <Card style={styles.fundingCard}>
            <View style={styles.fundingTop}>
              <Text style={styles.fundingValue}>{collected.toLocaleString()}</Text>
              <Text style={styles.fundingCurrency}>{t('common.currency')}</Text>
              <View style={styles.spacer} />
              <Pill label={t('home.percentFunded', { percent: Math.round(fundingProgress * 100) })} tone="success" />
            </View>
            <Text style={styles.fundingGoal}>
              {t('home.ofGoal', { amount: target.toLocaleString(), currency: t('common.currency') })}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${fundingProgress * 100}%` }]} />
            </View>

            <View style={styles.split}>
              <View style={styles.splitCell}>
                <View style={styles.splitLabelRow}>
                  <Text style={styles.splitLabel}>{t('project.ticketPrice')}</Text>
                  <Pressable hitSlop={10} onPress={() => showHint(t('project.ticketPrice'), t('project.ticketPriceHint'))}>
                    <Text style={styles.hintIconInline}>ⓘ</Text>
                  </Pressable>
                </View>
                <Text style={styles.splitValue}>{money(currentPrice)}</Text>
              </View>
              <View style={styles.splitDivider} />
              <View style={styles.splitCell}>
                <View style={styles.splitLabelRow}>
                  <Text style={styles.splitLabel}>{t('project.ticketsLeft')}</Text>
                  <Pressable hitSlop={10} onPress={() => showHint(t('project.ticketsLeft'), t('project.ticketsLeftHint'))}>
                    <Text style={styles.hintIconInline}>ⓘ</Text>
                  </Pressable>
                </View>
                <Text style={styles.splitValue}>
                  {ticketsLeft}
                  <Text style={styles.splitValueMuted}> / {project.totalTickets}</Text>
                </Text>
              </View>
            </View>

            {/* Shortcuts to the two places on this page a reader most often wants next. Both
                are counts, so they double as a signal that there is anything there at all. */}
            {(hasActiveListings || worksCount > 0) && (
              <View style={styles.jumpRow}>
                {hasActiveListings && (
                  <Pressable style={styles.jumpChip} hitSlop={4} onPress={goToResale}>
                    <Icon name="refresh" color={colors.primary} size={13} />
                    <Text style={styles.jumpChipText}>
                      {t('project.resaleExtra', { count: project.resaleTicketsCount })}
                    </Text>
                    <Text style={styles.jumpChipChevron}>›</Text>
                  </Pressable>
                )}
                {worksCount > 0 && (
                  <Pressable
                    style={styles.jumpChip}
                    hitSlop={4}
                    onPress={() => navigation.navigate('ProjectWorks', { projectId: project.id })}
                  >
                    <Icon name="wrench" color={colors.primary} size={13} />
                    <Text style={styles.jumpChipText}>{t('project.worksCount', { count: worksCount })}</Text>
                    <Text style={styles.jumpChipChevron}>›</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        </TourTarget>

        <TourTarget id="project.tabs" style={styles.tabsWrap}>
          <SegmentedTabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'about', label: t('project.tabAbout') },
              { key: 'updates', label: t('project.tabUpdates') },
              { key: 'questions', label: t('project.tabQuestions') },
              { key: 'team', label: t('project.tabTeam') },
              { key: 'market', label: t('project.tabMarket') },
              { key: 'activity', label: t('project.tabActivity') },
            ]}
          />
        </TourTarget>

        {tab === 'about' ? (
          aboutPanel
        ) : tab === 'updates' ? (
          <ProjectUpdatesPanel project={project} />
        ) : tab === 'questions' ? (
          // Reloads the project after an answer so the responsiveness header
          // above the list moves with it rather than a screen later.
          <ProjectQuestionsPanel project={project} onChanged={load} />
        ) : tab === 'team' ? (
          teamPanel
        ) : tab === 'market' ? (
          marketPanel
        ) : (
          activityPanel
        )}

        {/* Not rendered at all once the raise is over. It used to sit open on a
            funded project with a live-looking confirm button that could only fail:
            nothing left to sell, and the stepper clamped to zero. */}
        {isRaising && (
        <TourTarget id="project.buy" style={styles.buyFooter}>
          <SectionHeader title={t('project.buySection')} />
          <Card>
      <View style={styles.buySummary}>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            hitSlop={4}
            disabled={parsedQuantity <= 1}
            onPress={() => setQuantityBy(-1)}
          >
            <Text style={[styles.stepIcon, parsedQuantity <= 1 && styles.stepIconDisabled]}>−</Text>
          </Pressable>
          {/* The arrows clamped to ticketsLeft; typing did not. At 71 available the
              field accepted 999 and showed "to pay 3 889 716 ֏" — which was in fact
              the cost of all 71, since the sum clamps and the number did not. The
              button then refused with no reason given, so it read as broken.
              Clamping the digits themselves is what makes the two agree. Zero and an
              empty field are left alone: they are how someone clears it before
              typing, and the button is already disabled for both. */}
          <TextInput
            style={styles.stepValue}
            value={quantity}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '');
              if (digits === '') {
                setQuantity('');
                return;
              }
              setQuantity(String(Math.min(parseInt(digits, 10), ticketsLeft)));
            }}
            keyboardType="number-pad"
            selectTextOnFocus
            maxLength={5}
          />
          <Pressable
            style={styles.stepButton}
            hitSlop={4}
            disabled={parsedQuantity >= ticketsLeft}
            onPress={() => setQuantityBy(1)}
          >
            <Text style={[styles.stepIcon, parsedQuantity >= ticketsLeft && styles.stepIconDisabled]}>+</Text>
          </Pressable>
        </View>
        <View style={styles.costBlock}>
          <Text style={styles.costLabel} numberOfLines={1}>
            {t('project.toPay')}
          </Text>
          {/* Shrinks to fit rather than clipping — the total is the number the whole screen
              is about, and a six-figure sum in drams is genuinely long. */}
          <Text style={styles.costValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {money(totalCost)}
          </Text>
        </View>
      </View>

      {/* Says out loud what the clamp above enforces, so a field that stops counting
          up reads as a limit rather than a stuck input. */}
      <Text style={styles.ticketsAvailableHint}>{t('project.ticketsAvailable', { count: ticketsLeft })}</Text>

      {spendable !== null && (
        <View style={styles.fundsRow}>
          <Text style={styles.fundsAvailable} numberOfLines={1}>
            {t('project.availableFunds')}: {money(spendable)}
          </Text>
          <Pressable
            style={[styles.maxChip, maxChipDisabled && styles.maxChipDisabled]}
            hitSlop={6}
            disabled={maxChipDisabled}
            onPress={() => setQuantity(String(maxAffordable))}
          >
            <Text style={[styles.maxChipText, maxChipDisabled && styles.maxChipTextDisabled]}>
              {t('project.buyMax')}
            </Text>
          </Pressable>
        </View>
      )}

      <PrimaryButton title={t('project.confirmPurchase')} onPress={handleBuy} loading={buying} disabled={!canBuy} />

      {parsedQuantity > 0 && (
        <>
          <Pressable style={styles.forecastToggle} onPress={() => setForecastOpen((open) => !open)}>
            <Text style={styles.forecastSummary}>
              {t('project.forecastSummary', {
                amount: expectedMonthlyProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }),
                currency: t('common.currency'),
              })}
            </Text>
            <Text style={styles.forecastCaret}>{forecastOpen ? '⌃' : '⌄'}</Text>
          </Pressable>

          {forecastOpen && (
            <View style={styles.forecastDetail}>
              <Pressable
                style={styles.forecastHintRow}
                onPress={() => showHint(t('project.calculatorTitle'), t('project.calculatorHint'))}
              >
                <Text style={styles.forecastHintLabel}>{t('project.calculatorTitle')}</Text>
                <Text style={styles.hintIconInline}>ⓘ</Text>
              </Pressable>
              <View style={styles.forecastRow}>
                <Text style={styles.forecastKey}>{t('project.ticketsToReceive')}</Text>
                <Text style={styles.forecastVal}>{parsedQuantity}</Text>
              </View>
              <View style={styles.forecastRow}>
                <Text style={styles.forecastKey}>{t('project.equityToReceive')}</Text>
                <Text style={styles.forecastVal}>{percent(purchaseEquity, 4)}</Text>
              </View>
              <View style={styles.forecastRow}>
                <Text style={styles.forecastKey}>{t('project.payoutStarts')}</Text>
                <Text style={styles.forecastVal}>{t('project.inDays', { days: project.payoutStartDays })}</Text>
              </View>
              <View style={styles.forecastRow}>
                <Text style={styles.forecastKey}>{t('project.expectedDailyProfit')}</Text>
                <Text style={styles.forecastVal}>{roundedMoney(expectedDailyProfit)}</Text>
              </View>
              <View style={styles.forecastRow}>
                <Text style={styles.forecastKey}>{t('project.expectedMonthlyProfit')}</Text>
                <Text style={[styles.forecastVal, styles.forecastValGood]}>{roundedMoney(expectedMonthlyProfit)}</Text>
              </View>
              <View style={styles.forecastRow}>
                <Text style={styles.forecastKey}>{t('project.paybackPeriod')}</Text>
                <Text style={styles.forecastVal}>{t('project.paybackPeriodValue', { days: paybackDays })}</Text>
              </View>
            </View>
          )}
        </>
      )}
          </Card>
        </TourTarget>
        )}
      </ScrollView>

      <RiskLevelModal visible={riskModalVisible} project={project} onClose={() => setRiskModalVisible(false)} />
      <InvestorsListModal
        visible={investorsModalVisible && !selectedInvestorId}
        investors={investorSummaries}
        onClose={() => setInvestorsModalVisible(false)}
        onSelect={(buyerId) => setSelectedInvestorId(buyerId)}
      />
      <InvestorProfileModal
        visible={!!selectedInvestorId}
        investorId={selectedInvestorId}
        excludeProjectId={project.id}
        investedQuantity={selectedInvestorSummary?.quantity}
        investedAmount={selectedInvestorSummary?.amount}
        onClose={() => setSelectedInvestorId(null)}
      />
      <HintModal hint={hint} onClose={() => setHint(null)} />
      <BuyListingModal
        listing={buyingListing}
        submitting={buyingListingSubmitting}
        onClose={() => setBuyingListing(null)}
        onConfirm={handleBuyListing}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
    },
    // Capped on the content container rather than by wrapping the children: the tab strip
    // is sticky, and `stickyHeaderIndices` counts direct children of the ScrollView — a
    // wrapper would put the strip out of reach and it would scroll away.
    contentWide: {
      maxWidth: maxWidth.column,
      width: '100%',
      alignSelf: 'center',
    },

    // hero
    hero: {
      height: 260,
      justifyContent: 'flex-end',
      backgroundColor: c.primaryDark,
    },
    heroFallback: {
      backgroundColor: c.primaryDark,
    },
    backButton: {
      position: 'absolute',
      left: spacing.md,
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(10, 18, 12, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpFloat: {
      position: 'absolute',
      right: spacing.md,
    },
    backIcon: {
      color: c.onOverlay,
      fontSize: 22,
      lineHeight: 24,
      marginTop: -2,
    },
    heroBody: {
      padding: spacing.md,
      // Clears the funding card, plus the normal gap — otherwise the founder line sits
      // underneath it.
      paddingBottom: spacing.md + FUNDING_CARD_OVERLAP,
    },
    heroStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: c.onOverlayFill,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 4,
      marginBottom: spacing.sm,
    },
    heroDot: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      // Fixed in both themes: this sits on the scrimmed cover photo, not on the app ground,
      // so it needs to stay bright enough to read against whatever image is behind it.
      backgroundColor: '#6EE7A0',
    },
    heroStatusText: {
      ...typography.eyebrow,
      color: c.onOverlay,
    },
    heroTitle: {
      ...typography.title,
      color: c.onOverlay,
      marginBottom: spacing.xs + 2,
    },
    heroFounder: {
      alignSelf: 'flex-start',
    },
    heroFounderText: {
      ...typography.captionStrong,
      color: c.onOverlayMuted,
    },

    // funding
    fundingWrap: {
      paddingHorizontal: spacing.sm + 4,
      marginTop: -FUNDING_CARD_OVERLAP,
    },
    fundingCard: {
      borderRadius: radius.xl,
    },
    fundingTop: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 3,
    },
    spacer: {
      flex: 1,
    },
    fundingValue: {
      ...typography.display,
      ...tabularNums,
      color: c.text,
    },
    fundingCurrency: {
      ...typography.subheading,
      color: c.textMuted,
    },
    fundingGoal: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: 2,
      marginBottom: spacing.sm + 4,
    },
    track: {
      height: 7,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: radius.pill,
      backgroundColor: c.success,
    },
    split: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md - 2,
      paddingTop: spacing.md - 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    splitCell: {
      flex: 1,
    },
    splitDivider: {
      width: 1,
      backgroundColor: c.border,
    },
    splitLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: 3,
    },
    splitLabel: {
      ...typography.micro,
      color: c.textMuted,
    },
    splitValue: {
      ...typography.subheading,
      ...tabularNums,
      color: c.text,
    },
    splitValueMuted: {
      ...typography.micro,
      fontWeight: '600',
      color: c.textMuted,
    },
    // Jump chips under the funding split. Outlined rather than filled: they are navigation,
    // not another number competing with the price and the ticket count above them.
    jumpRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm - 2,
      marginTop: spacing.md - 4,
    },
    jumpChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 1,
      paddingVertical: 5,
      paddingLeft: spacing.sm + 2,
      paddingRight: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSunken,
    },
    jumpChipText: {
      ...typography.microStrong,
      color: c.primary,
    },
    jumpChipChevron: {
      ...typography.captionStrong,
      color: c.primary,
      marginTop: -2,
    },

    // tabs
    // Pinned to the top while a panel scrolls, so it needs an opaque ground of its own and a
    // rule to sit against the content passing beneath it.
    tabsWrap: {
      backgroundColor: c.background,
      paddingHorizontal: spacing.sm + 4,
      paddingTop: spacing.md - 2,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    panel: {
      paddingHorizontal: spacing.sm + 4,
      paddingTop: spacing.md,
    },
    buyFooter: {
      paddingHorizontal: spacing.sm + 4,
      paddingTop: spacing.lg,
    },

    description: {
      ...typography.body,
      color: c.text,
      marginBottom: spacing.md + 2,
    },
    emptyNote: {
      ...typography.caption,
      color: c.textMuted,
      marginBottom: spacing.md,
    },
    teamCaption: {
      ...typography.caption,
      color: c.textMuted,
      marginBottom: spacing.md - 4,
    },
    hintIconInline: {
      ...typography.microStrong,
      color: c.textMuted,
    },

    youtubeWrapper: {
      marginBottom: spacing.md + 2,
    },
    youtubeLinkButton: {
      alignSelf: 'flex-start',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md + 2,
    },
    youtubeLinkText: {
      ...typography.captionStrong,
      color: c.primary,
    },

    roundBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm + 4,
    },
    roundBadge: {
      ...typography.captionStrong,
      color: c.primary,
    },

    // Wraps the whole resale block so the arrival flash frames what the user was sent to,
    // not just the first card in it. Transparent until the animation paints it.
    resaleHighlight: {
      borderWidth: 1,
      borderRadius: radius.lg + 3,
      padding: spacing.xs,
      margin: -spacing.xs,
    },
    resaleBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 3,
      marginBottom: spacing.sm + 2,
    },
    resalePlaque: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resaleBannerBody: {
      flex: 1,
    },
    resaleBannerTitle: {
      ...typography.captionStrong,
      color: c.text,
    },
    resaleBannerNote: {
      ...typography.micro,
      color: c.textMuted,
      marginTop: 2,
    },
    // Cheaper than the round price is the good outcome for a buyer, dearer the bad one —
    // that is the reading, so it gets the semantic colours rather than a neutral grey.
    deltaGood: {
      color: c.success,
      fontWeight: '700',
    },
    deltaBad: {
      color: c.warning,
      fontWeight: '700',
    },

    listingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md - 4,
      marginBottom: spacing.sm,
    },
    listingInfo: {
      flex: 1,
    },
    listingSellerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      flexWrap: 'wrap',
    },
    listingSeller: {
      ...typography.captionStrong,
      color: c.text,
    },
    listingMeta: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
      marginTop: 2,
    },
    listingDelta: {
      ...typography.micro,
      marginTop: 2,
    },
    listingAction: {
      alignItems: 'flex-end',
      gap: spacing.xs + 1,
    },
    listingPrice: {
      ...typography.labelStrong,
      ...tabularNums,
      color: c.text,
    },

    buyerCard: {
      marginBottom: spacing.sm,
    },
    buyerHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    buyerName: {
      ...typography.captionStrong,
      color: c.text,
      flex: 1,
    },
    buyerTotal: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.text,
    },
    chevron: {
      ...typography.captionStrong,
      color: c.primary,
    },
    purchaseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: spacing.xs + 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    purchaseInfo: {
      flex: 1,
    },
    purchaseMeta: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
    },
    purchaseDate: {
      ...typography.eyebrow,
      textTransform: 'none',
      letterSpacing: 0,
      fontWeight: '400',
      color: c.textMuted,
      marginTop: 1,
    },
    purchaseTotal: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.text,
    },
    grandTotalRow: {
      paddingTop: spacing.sm + 4,
      paddingHorizontal: 2,
      alignItems: 'flex-end',
    },
    grandTotalLabel: {
      ...typography.captionStrong,
      ...tabularNums,
      color: c.text,
    },

    // buy bar
    buySummary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm + 2,
      marginBottom: spacing.md - 4,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      overflow: 'hidden',
      flexShrink: 0,
    },
    stepButton: {
      width: 36,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIcon: {
      ...typography.heading,
      color: c.primary,
    },
    stepIconDisabled: {
      color: c.textMuted,
      opacity: 0.45,
    },
    stepValue: {
      ...typography.bodyStrong,
      ...tabularNums,
      color: c.text,
      // Fixed, not minWidth: an Android TextInput with no width claims its own intrinsic
      // width, and the stepper never shrinks — which starves the total beside it.
      width: 56,
      height: 38,
      textAlign: 'center',
      paddingVertical: 0,
    },
    costBlock: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
    },
    costLabel: {
      ...typography.eyebrow,
      color: c.textMuted,
    },
    costValue: {
      ...typography.heading,
      ...tabularNums,
      color: c.text,
      // adjustsFontSizeToFit only shrinks when the Text has a width to shrink into;
      // sized by its own content it ellipsizes instead. Stretch it across costBlock.
      alignSelf: 'stretch',
      textAlign: 'right',
    },
    fundsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.md - 4,
    },
    fundsAvailable: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
      flexShrink: 1,
    },
    ticketsAvailableHint: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
      marginTop: spacing.xs,
    },
    maxChip: {
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.primary,
      flexShrink: 0,
    },
    maxChipDisabled: {
      borderColor: c.border,
    },
    maxChipText: {
      ...typography.microStrong,
      color: c.primary,
    },
    maxChipTextDisabled: {
      color: c.textMuted,
    },
    forecastToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 1,
      paddingTop: spacing.sm + 1,
    },
    forecastSummary: {
      ...typography.micro,
      color: c.textMuted,
    },
    forecastCaret: {
      ...typography.micro,
      color: c.textMuted,
    },
    forecastDetail: {
      marginTop: spacing.sm + 2,
      paddingTop: spacing.sm + 2,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    forecastHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    forecastHintLabel: {
      ...typography.captionStrong,
      color: c.text,
    },
    forecastRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: 3,
    },
    forecastKey: {
      ...typography.micro,
      color: c.textMuted,
      flex: 1,
    },
    forecastVal: {
      ...typography.microStrong,
      ...tabularNums,
      color: c.text,
    },
    forecastValGood: {
      color: c.success,
    },
  });
