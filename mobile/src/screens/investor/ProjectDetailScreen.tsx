import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchProject, fetchProjectPurchases, fetchProjectListings, fetchProjectAttachments } from '../../api/projects';
import { buyTicket, buyListing } from '../../api/tickets';
import { resolveMediaUrl } from '../../api/client';
import { Project, ProjectAttachment, ProjectPurchase, TicketListing } from '../../types';
import { getLocalizedText } from '../../utils/localized';
import { computeTicketPurchaseCost } from '../../utils/pricing';
import { formatDate, formatDateTime } from '../../utils/date';
import { showAlert } from '../../utils/alert';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing } from '../../theme';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import { TicketPriceChart } from '../../components/TicketPriceChart';
import { RiskLevelModal } from '../../components/RiskLevelModal';
import { InvestorsListModal, InvestorSummary } from '../../components/InvestorsListModal';
import { InvestorProfileModal } from '../../components/InvestorProfileModal';
import { StatBlock } from '../../components/StatBlock';
import { HintModal } from '../../components/HintModal';
import { RichTextView } from '../../components/RichTextView';
import { BuyListingModal } from '../../components/BuyListingModal';
import { RoundLadder } from '../../components/RoundLadder';
import { InvestorHomeStackParamList } from '../../navigation/InvestorNavigator';

// Raw DOM tag — real YouTube embed on web; native shows an "open in YouTube" link instead.
const HtmlIframe: any = 'iframe';

function extractYoutubeVideoId(url: string): string | null {
  const match = url.trim().match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Secondary metadata (risk, investor count, dates) doesn't carry its own purchase-decision
// weight the way ticket price/availability does, so it's a row of compact chips rather than
// full bordered stat cards — keeps a single visual tier for "supporting info" instead of
// mixing full-size cards with colored vs. plain borders depending on whether one is tappable.
function MetaChip({
  icon,
  label,
  value,
  onPress,
  onHintPress,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  onPress?: () => void;
  onHintPress?: () => void;
}) {
  const clickable = !!onPress;
  return (
    <Pressable style={styles.metaChip} onPress={onPress} disabled={!clickable}>
      <Text style={styles.metaChipIcon}>{icon}</Text>
      <View style={styles.metaChipTextBlock}>
        <Text style={styles.metaChipLabel} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.metaChipValueRow}>
          <Text style={[styles.metaChipValue, clickable && styles.metaChipValueClickable]} numberOfLines={1}>
            {value}
          </Text>
          {clickable && <Text style={styles.metaChipChevron}>›</Text>}
          {onHintPress && (
            <Pressable hitSlop={10} onPress={onHintPress}>
              <Text style={styles.metaChipHintIcon}>ⓘ</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
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
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [project, setProject] = useState<Project | null>(null);
  const [purchases, setPurchases] = useState<ProjectPurchase[]>([]);
  const [listings, setListings] = useState<TicketListing[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [buying, setBuying] = useState(false);
  const [buyingListing, setBuyingListing] = useState<TicketListing | null>(null);
  const [buyingListingSubmitting, setBuyingListingSubmitting] = useState(false);
  const [riskModalVisible, setRiskModalVisible] = useState(false);
  const [investorsModalVisible, setInvestorsModalVisible] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(null);
  const [hint, setHint] = useState<{ title: string; description: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const resaleSectionY = useRef(0);
  const consumedResaleScrollParam = useRef(false);

  const showHint = (title: string, description: string) => setHint({ title, description });
  const scrollToResale = () => scrollRef.current?.scrollTo({ y: resaleSectionY.current, animated: true });

  const load = useCallback(() => {
    fetchProject(projectId).then(setProject);
    fetchProjectPurchases(projectId).then(setPurchases);
    fetchProjectListings(projectId).then(setListings);
    fetchProjectAttachments(projectId).then(setAttachments);
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    navigation.setOptions({ title: getLocalizedText(project.title, i18n.language) });
  }, [project, i18n.language, navigation]);

  useEffect(() => {
    if (!project || !route.params.scrollToResale || consumedResaleScrollParam.current) return;
    consumedResaleScrollParam.current = true;
    const timer = setTimeout(scrollToResale, 350);
    return () => clearTimeout(timer);
  }, [project, route.params.scrollToResale]);

  useFocusEffect(load);

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

  const totalSold = useMemo(
    () => ({
      quantity: purchases.reduce((sum, p) => sum + p.quantity, 0),
      amount: purchases.reduce((sum, p) => sum + p.totalPrice, 0),
    }),
    [purchases],
  );

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
  const ticketsLeft = project.totalTickets - project.ticketsSold;
  const hasActiveListings = project.resaleEnabled && (project.resaleTicketsCount ?? 0) > 0;
  const collected = parseFloat(project.collectedAmount);
  const target = parseFloat(project.targetAmount);
  const fundingProgress = target > 0 ? Math.min(collected / target, 1) : 0;
  const parsedQuantity = Math.max(0, parseInt(quantity, 10) || 0);
  const totalCost = computeTicketPurchaseCost(pricing.tiers, project.ticketsSold, parsedQuantity);

  const annualReturnRate = parseFloat(project.expectedAnnualReturnPercent) / 100;
  const expectedDailyProfit = (totalCost * annualReturnRate) / 365;
  const expectedMonthlyProfit = expectedDailyProfit * 30;
  const paybackDays = annualReturnRate > 0 ? Math.round(36500 / parseFloat(project.expectedAnnualReturnPercent)) : 0;

  const chartPoints =
    purchases.length > 0
      ? purchases.map((p) => ({
          unitPrice: p.unitPrice,
          quantity: p.quantity,
          totalPrice: p.totalPrice,
          buyerName: p.buyerName,
          date: p.purchaseDate,
        }))
      : pricing.tiers.map((tier) => ({ unitPrice: tier.price }));

  const handleBuy = async () => {
    setBuying(true);
    try {
      await buyTicket(project.id, parsedQuantity);
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
        showAlert(t('common.error'), message ?? undefined);
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
        showAlert(t('common.error'), message ?? undefined);
      }
    } finally {
      setBuyingListingSubmitting(false);
    }
  };

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      {project.coverImageUrl ? (
        <Image source={{ uri: resolveMediaUrl(project.coverImageUrl) }} style={styles.cover} />
      ) : null}
      <Text style={styles.title}>{getLocalizedText(project.title, i18n.language)}</Text>
      {project.founderName && (
        <Pressable style={[styles.nameChip, styles.founderChip]} onPress={() => setSelectedInvestorId(project.founderId)}>
          <Text style={styles.nameChipText}>
            👤 {t('project.by')} {project.founderName}
          </Text>
        </Pressable>
      )}
      <Text style={styles.section}>{t('project.about')}</Text>
      <RichTextView html={getLocalizedText(project.description, i18n.language)} textStyle={styles.description} />

      {project.youtubeUrl &&
        (() => {
          const videoId = extractYoutubeVideoId(project.youtubeUrl!);
          if (!videoId) return null;
          return Platform.OS === 'web' ? (
            <View style={styles.youtubeWrapper}>
              <HtmlIframe
                src={`https://www.youtube.com/embed/${videoId}`}
                style={youtubeIframeStyle}
                allowFullScreen
              />
            </View>
          ) : (
            <Pressable
              style={styles.youtubeLinkButton}
              onPress={() => Linking.openURL(project.youtubeUrl!)}
            >
              <Text style={styles.youtubeLinkText}>▶ {t('project.watchOnYoutube')}</Text>
            </Pressable>
          );
        })()}

      {attachments.length > 0 && (
        <View style={styles.attachmentsBox}>
          <Text style={styles.attachmentsTitle}>{t('project.attachmentsTitle')}</Text>
          {attachments.map((file) => (
            <Pressable
              key={file.id}
              style={styles.attachmentRow}
              onPress={() => Linking.openURL(resolveMediaUrl(file.fileUrl))}
            >
              <Text style={styles.attachmentName} numberOfLines={1}>
                📄 {file.fileName}
              </Text>
              <Text style={styles.attachmentMeta}>{formatFileSize(file.fileSize)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.fundingHeroRow}>
        <Text style={styles.fundingHeroValue}>
          {collected.toLocaleString()} {t('common.currency')}
        </Text>
        <View style={styles.percentBadge}>
          <Text style={styles.percentBadgeText}>
            {t('home.percentFunded', { percent: Math.round(fundingProgress * 100) })}
          </Text>
        </View>
      </View>
      <Text style={styles.fundingGoalMeta}>
        {t('home.ofGoal', { amount: target.toLocaleString(), currency: t('common.currency') })}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fundingProgress * 100}%` }]} />
      </View>

      <View style={styles.statsGrid}>
        <StatBlock
          icon="🎫"
          label={t('project.ticketPrice')}
          value={`${currentPrice.toLocaleString()} ${t('common.currency')}`}
          onHintPress={() => showHint(t('project.ticketPrice'), t('project.ticketPriceHint'))}
        />
        <StatBlock
          icon="📦"
          label={t('project.ticketsLeft')}
          value={`${ticketsLeft} / ${project.totalTickets}`}
          note={hasActiveListings ? `🔁 ${t('project.resaleBadge', { count: project.resaleTicketsCount })}` : undefined}
          onNotePress={hasActiveListings ? scrollToResale : undefined}
          onHintPress={() => showHint(t('project.ticketsLeft'), t('project.ticketsLeftHint'))}
        />
      </View>

      <View style={styles.metaChipsRow}>
        {project.riskLevel && (
          <MetaChip
            icon="⚠️"
            label={t('project.riskLevel')}
            value={t(`project.risk.${project.riskLevel}`)}
            onPress={() => setRiskModalVisible(true)}
          />
        )}
        <MetaChip
          icon="👥"
          label={t('project.investors')}
          value={project.investorCount ?? 0}
          onPress={investorSummaries.length > 0 ? () => setInvestorsModalVisible(true) : undefined}
        />
        <MetaChip
          icon="📅"
          label={t('home.started')}
          value={formatDate(project.createdAt, i18n.language)}
          onHintPress={() => showHint(t('home.started'), t('project.startedHint'))}
        />
        {project.deadline && (
          <MetaChip
            icon="⏳"
            label={t('home.deadline')}
            value={formatDate(project.deadline, i18n.language)}
            onHintPress={() => showHint(t('home.deadline'), t('project.deadlineHint'))}
          />
        )}
      </View>

      <Pressable
        style={styles.financeLinkRow}
        onPress={() => navigation.navigate('ProjectFinance', { projectId: project.id })}
      >
        <Text style={styles.financeLinkIcon}>💰</Text>
        <Text style={styles.financeLinkLabel}>{t('project.finance.title')}</Text>
        <Text style={styles.financeLinkAction}>{t('project.finance.viewAction')} ›</Text>
      </Pressable>

      {project.resaleEnabled ? (
        <Pressable
          style={styles.resaleBanner}
          onPress={hasActiveListings ? scrollToResale : undefined}
          disabled={!hasActiveListings}
        >
          <Text style={styles.resaleBannerIcon}>🔁</Text>
          <View style={styles.resaleBannerBody}>
            <Text style={styles.resaleBannerTitle}>
              {hasActiveListings
                ? t('project.resaleBannerActive', { count: project.resaleTicketsCount })
                : t('project.resaleAllowed')}
            </Text>
            {hasActiveListings && <Text style={styles.resaleBannerCta}>{t('project.resaleBannerCta')}</Text>}
          </View>
        </Pressable>
      ) : (
        <Text style={styles.resaleNote}>{t('project.resaleNotAllowed')}</Text>
      )}

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

      <Text style={styles.section}>{t('project.priceChart')}</Text>
      <TicketPriceChart points={chartPoints} isProjected={purchases.length === 0} />

      <View style={styles.roundLadderWrapper}>
        <RoundLadder tiers={pricing.tiers} currentTier={pricing.currentTier} />
      </View>

      <TextField
        label={t('project.quantity')}
        keyboardType="number-pad"
        format="integer"
        placeholder="1"
        value={quantity}
        onChangeText={setQuantity}
      />
      <View style={styles.calculator}>
        <View style={styles.calcRow}>
          <Text style={styles.totalCostLabel}>{t('project.totalCost')}</Text>
          <Text style={styles.totalCostValue}>
            {totalCost.toLocaleString()} {t('common.currency')}
          </Text>
        </View>

        {parsedQuantity > 0 && (
          <>
            <View style={styles.calcDivider} />
            <Pressable
              style={styles.calculatorTitleRow}
              onPress={() => showHint(t('project.calculatorTitle'), t('project.calculatorHint'))}
            >
              <Text style={styles.calculatorTitle}>{t('project.calculatorTitle')}</Text>
              <Text style={styles.hintIconInline}>ⓘ</Text>
            </Pressable>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>{t('project.ticketsToReceive')}</Text>
              <Text style={styles.calcValue}>{parsedQuantity}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>{t('project.payoutStarts')}</Text>
              <Text style={styles.calcValue}>{t('project.inDays', { days: project.payoutStartDays })}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>{t('project.expectedDailyProfit')}</Text>
              <Text style={styles.calcValue}>
                {expectedDailyProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('common.currency')}
              </Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>{t('project.expectedMonthlyProfit')}</Text>
              <Text style={styles.calcValueHighlight}>
                {expectedMonthlyProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} {t('common.currency')}
              </Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>{t('project.paybackPeriod')}</Text>
              <Text style={styles.calcValue}>{t('project.paybackPeriodValue', { days: paybackDays })}</Text>
            </View>
          </>
        )}
      </View>

      <PrimaryButton
        title={t('project.confirmPurchase')}
        onPress={handleBuy}
        loading={buying}
        disabled={parsedQuantity < 1 || parsedQuantity > ticketsLeft}
      />

      <Text style={[styles.section, styles.historyHeader]}>{t('project.purchaseHistory')}</Text>
      {buyerGroups.length === 0 ? (
        <Text style={styles.description}>{t('project.noPurchasesYet')}</Text>
      ) : (
        <>
          {buyerGroups.map((group) => {
            const summary = investorSummaries.find((s) => s.buyerId === group.buyerId);
            const buyerQuantity = summary?.quantity ?? 0;
            const buyerAmount = summary?.amount ?? 0;
            return (
              <View key={group.buyerId} style={styles.buyerCard}>
                <Pressable style={styles.nameChip} onPress={() => setSelectedInvestorId(group.buyerId)}>
                  <Text style={styles.nameChipText}>👤 {group.buyerName}</Text>
                </Pressable>
                {group.purchases.map((purchase) => (
                  <View key={purchase.id} style={styles.purchaseRow}>
                    <View>
                      <Text style={styles.purchaseMeta}>
                        x{purchase.quantity} · {purchase.unitPrice.toLocaleString()} {t('common.currency')}/{t(
                          'project.perUnit',
                        )}
                      </Text>
                      <Text style={styles.purchaseDate}>{formatDateTime(purchase.purchaseDate, i18n.language)}</Text>
                    </View>
                    <Text style={styles.purchaseTotal}>
                      {purchase.totalPrice.toLocaleString()} {t('common.currency')}
                    </Text>
                  </View>
                ))}
                <Text style={styles.buyerSubtotal}>
                  {t('project.buyerSubtotal', {
                    quantity: buyerQuantity,
                    amount: buyerAmount.toLocaleString(),
                    currency: t('common.currency'),
                  })}
                </Text>
              </View>
            );
          })}
          <Text style={styles.totalSold}>
            {t('project.totalSold', {
              quantity: totalSold.quantity,
              amount: totalSold.amount.toLocaleString(),
              currency: t('common.currency'),
            })}
          </Text>
        </>
      )}

      {project.resaleEnabled && (
        <View onLayout={(e) => (resaleSectionY.current = e.nativeEvent.layout.y)}>
          <Text style={[styles.section, styles.historyHeader]}>{t('project.resaleMarketTitle')}</Text>
          {listings.length === 0 ? (
            <Text style={styles.description}>{t('project.noListings')}</Text>
          ) : (
            listings.map((listing) => {
              const isOwn = listing.sellerId === currentUserId;
              return (
                <View key={listing.id} style={[styles.listingCard, isOwn && styles.listingCardOwn]}>
                  <View style={styles.listingInfo}>
                    <View style={styles.listingSellerRow}>
                      <Text style={styles.purchaseBuyer}>{listing.sellerName}</Text>
                      {isOwn && (
                        <View style={styles.ownListingBadge}>
                          <Text style={styles.ownListingBadgeText}>{t('project.ownListing')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.purchaseMeta}>
                      x{listing.quantity} · {listing.unitPrice.toLocaleString()} {t('common.currency')}/{t(
                        'project.perUnit',
                      )}
                    </Text>
                  </View>
                  <View style={styles.listingAction}>
                    <Text style={styles.purchaseTotal}>
                      {listing.askingPrice.toLocaleString()} {t('common.currency')}
                    </Text>
                    {!isOwn && (
                      <PrimaryButton
                        title={t('project.buyListing')}
                        size="small"
                        onPress={() => setBuyingListing(listing)}
                      />
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

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
  cover: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: spacing.md,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  nameChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  nameChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  founderChip: {
    marginBottom: spacing.md,
  },
  section: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    columnGap: spacing.md,
    marginBottom: spacing.md,
  },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    columnGap: spacing.sm,
    marginBottom: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  metaChipIcon: {
    fontSize: 15,
    marginRight: spacing.xs,
  },
  metaChipTextBlock: {
    flexShrink: 1,
  },
  metaChipLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaChipValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaChipValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  metaChipValueClickable: {
    color: colors.primary,
  },
  metaChipChevron: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 2,
  },
  metaChipHintIcon: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    marginLeft: spacing.xs,
    padding: 2,
  },
  financeLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  financeLinkIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  financeLinkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  financeLinkAction: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  fundingHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  fundingHeroValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  percentBadge: {
    backgroundColor: 'rgba(34, 165, 89, 0.12)',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  percentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  fundingGoalMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  resaleNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  resaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  resaleBannerIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  resaleBannerBody: {
    flex: 1,
  },
  resaleBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  resaleBannerCta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  roundBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  roundBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginRight: spacing.xs,
  },
  hintIconInline: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '700',
  },
  roundLadderWrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  calculator: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  totalCostLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  totalCostValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  calcDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  calculatorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  calculatorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.xs,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  calcLabel: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  calcValueHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
  },
  historyHeader: {
    marginTop: spacing.xl,
  },
  listingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  listingCardOwn: {
    borderColor: colors.primary,
  },
  listingInfo: {
    flex: 1,
  },
  listingSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  listingAction: {
    alignItems: 'flex-end',
  },
  ownListingBadge: {
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  ownListingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  buyerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  purchaseBuyer: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  purchaseMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  purchaseDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  purchaseTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  buyerSubtotal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  totalSold: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  youtubeWrapper: {
    marginBottom: spacing.md,
  },
  youtubeLinkButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  youtubeLinkText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  attachmentsBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attachmentsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  attachmentMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
