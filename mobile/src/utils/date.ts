const LOCALE_MAP: Record<string, string> = {
  hy: 'hy-AM',
  ru: 'ru-RU',
  en: 'en-US',
};

export function formatDate(value: string | Date, language: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString(LOCALE_MAP[language] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | Date, language: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(LOCALE_MAP[language] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
