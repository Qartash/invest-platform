import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HeroScrim, Pill, SegmentedTabs } from '../../../components/ui';
import { RichTextView } from '../../../components/RichTextView';
import { spacing, tabularNums, ThemeColors, typography, useThemeStyles } from '../../../theme';
import { isRichTextEmpty } from '../../../utils/richText';

interface Props {
  coverUri?: string;
  title: string;
  /** Rich-text HTML in whichever language the founder is previewing. */
  description: string;
  founderName?: string;
  target: number;
  ticketPrice: number;
  totalTickets: number;
  totalTiers: number;
}

/**
 * The project as an investor meets it, assembled from the draft rather than from the server.
 * Deliberately a mirror of ProjectDetailScreen's hero + funding card + tabs — a preview that
 * invents its own layout is worse than no preview, because it teaches the founder to expect
 * something that will never appear.
 *
 * Rendered edge-to-edge by its caller: inside a bordered card it reads as a *picture* of the
 * page, which is exactly the wrong impression.
 */
export function ProjectPreview({
  coverUri,
  title,
  description,
  founderName,
  target,
  ticketPrice,
  totalTickets,
  totalTiers,
}: Props) {
  const styles = useThemeStyles(createStyles);
  const { t } = useTranslation();
  const currency = t('common.currency');
  const descriptionEmpty = isRichTextEmpty(description);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
            <Text style={styles.heroEmptyText}>{t('founder.wizard.previewNoCover')}</Text>
          </View>
        )}
        <HeroScrim />
        <View style={styles.heroBody}>
          <View style={styles.heroStatus}>
            <View style={styles.heroDot} />
            <Text style={styles.heroStatusText}>{t('founder.wizard.previewRound', { total: totalTiers })}</Text>
          </View>
          <Text style={styles.heroTitle}>{title.trim() || t('founder.wizard.previewNoTitle')}</Text>
          {founderName && <Text style={styles.heroFounder}>{t('project.by')} {founderName} ›</Text>}
        </View>
      </View>

      <View style={styles.funding}>
        {/* A draft has raised nothing yet — the zero state is the honest preview. */}
        <View style={styles.fundingTop}>
          <Text style={styles.fundingValue}>0</Text>
          <Text style={styles.fundingCurrency}>{currency}</Text>
          <View style={styles.spacer} />
          <Pill label={t('home.percentFunded', { percent: 0 })} tone="success" />
        </View>
        <Text style={styles.fundingGoal}>
          {t('home.ofGoal', { amount: target.toLocaleString(), currency })}
        </Text>
        <View style={styles.track}>
          <View style={styles.fill} />
        </View>

        <View style={styles.split}>
          <View style={styles.splitCell}>
            <Text style={styles.splitLabel}>{t('project.ticketPrice')}</Text>
            <Text style={styles.splitValue}>
              {ticketPrice > 0 ? `${ticketPrice.toLocaleString()} ${currency}` : '—'}
            </Text>
          </View>
          <View style={styles.splitDivider} />
          <View style={styles.splitCell}>
            <Text style={styles.splitLabel}>{t('project.ticketsLeft')}</Text>
            <Text style={styles.splitValue}>
              {totalTickets}
              <Text style={styles.splitValueMuted}> / {totalTickets}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Inert on purpose: the tabs are here so the founder recognises the real page, not
          so they can browse a draft that has no team panel or activity feed yet. */}
      <View style={styles.tabs} pointerEvents="none">
        <SegmentedTabs
          active="about"
          onChange={() => {}}
          tabs={[
            { key: 'about', label: t('project.tabAbout') },
            { key: 'team', label: t('project.tabTeam') },
            { key: 'market', label: t('project.tabMarket') },
            { key: 'activity', label: t('project.tabActivity') },
          ]}
        />
      </View>

      <View style={styles.about}>
        {descriptionEmpty ? (
          <Text style={styles.aboutEmpty}>{t('founder.wizard.previewNoDescription')}</Text>
        ) : (
          <RichTextView html={description} textStyle={styles.aboutText} />
        )}
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    root: {
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      marginBottom: spacing.md,
    },
    hero: {
      height: 190,
      backgroundColor: c.surfaceSunken,
      justifyContent: 'flex-end',
    },
    heroEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroEmptyText: {
      ...typography.captionStrong,
      color: c.textMuted,
    },
    heroBody: {
      padding: spacing.md,
    },
    heroStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      marginBottom: spacing.xs + 2,
    },
    heroDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.success,
    },
    heroStatusText: {
      ...typography.eyebrow,
      color: c.onOverlayMuted,
    },
    heroTitle: {
      ...typography.title,
      color: c.onOverlay,
    },
    heroFounder: {
      ...typography.micro,
      color: c.onOverlayMuted,
      marginTop: 3,
    },
    funding: {
      padding: spacing.md,
    },
    fundingTop: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs + 1,
    },
    fundingValue: {
      ...typography.title,
      ...tabularNums,
      color: c.text,
    },
    fundingCurrency: {
      ...typography.captionStrong,
      color: c.textMuted,
    },
    spacer: {
      flex: 1,
    },
    fundingGoal: {
      ...typography.micro,
      ...tabularNums,
      color: c.textMuted,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      width: 0,
      backgroundColor: c.primary,
    },
    split: {
      flexDirection: 'row',
      marginTop: spacing.md,
      paddingTop: spacing.sm + 4,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    splitCell: {
      flex: 1,
    },
    splitDivider: {
      width: 1,
      backgroundColor: c.border,
      marginHorizontal: spacing.md,
    },
    splitLabel: {
      ...typography.micro,
      color: c.textMuted,
      marginBottom: 3,
    },
    splitValue: {
      ...typography.subheading,
      ...tabularNums,
      color: c.text,
    },
    splitValueMuted: {
      ...typography.body,
      color: c.textMuted,
    },
    tabs: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm + 4,
    },
    about: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    aboutText: {
      ...typography.body,
      color: c.text,
    },
    // The founder should feel the hole in their own storefront, not read an error about it.
    aboutEmpty: {
      ...typography.body,
      color: c.danger,
      fontStyle: 'italic',
    },
  });
