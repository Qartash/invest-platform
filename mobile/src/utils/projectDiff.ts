import type { TFunction } from 'i18next';
import { getLocalizedText } from './localized';
import { formatDate } from './date';
import { stripHtml } from './richText';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';
import { LocalizedText } from '../types';

export const LOCALIZED_DIFF_FIELDS = ['title', 'description'];

export function getChangedLanguages(
  oldValue: LocalizedText | null | undefined,
  newValue: LocalizedText,
): SupportedLanguage[] {
  return SUPPORTED_LANGUAGES.filter((lang) => (oldValue?.[lang] ?? '') !== (newValue?.[lang] ?? ''));
}

// Description is stored as rich-text HTML; showing it raw in a diff preview
// renders the tags as literal text, so strip them down to plain text here.
export function formatLocalizedDiffText(field: string, value: string | undefined): string {
  if (!value) return '—';
  return field === 'description' ? stripHtml(value) : value;
}

export const DIFF_FIELD_LABEL_KEYS: Record<string, string> = {
  title: 'founder.titleField',
  description: 'founder.descriptionField',
  targetAmount: 'founder.targetAmount',
  ticketPrice: 'project.ticketPrice',
  totalTickets: 'founder.totalTickets',
  category: 'founder.categoryField',
  deadline: 'founder.deadline',
  priceTierCount: 'founder.priceTierCount',
  equityOfferedPercent: 'founder.equityOfferedPercent',
  resaleEnabled: 'founder.resaleEnabled',
  expectedAnnualReturnPercent: 'founder.expectedAnnualReturn',
  payoutStartDays: 'founder.payoutStartDays',
};

export function formatDiffValue(field: string, value: any, t: TFunction, lang: string): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (field) {
    case 'title':
    case 'description':
      return getLocalizedText(value, lang) || '—';
    case 'targetAmount':
    case 'ticketPrice':
      return `${parseFloat(value).toLocaleString()} ${t('common.currency')}`;
    case 'expectedAnnualReturnPercent':
    case 'equityOfferedPercent':
      return `${parseFloat(value)}%`;
    case 'deadline':
      return formatDate(value, lang);
    case 'resaleEnabled':
      return value ? t('common.yes') : t('common.no');
    default:
      return String(value);
  }
}
