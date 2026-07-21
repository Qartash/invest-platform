const LOCALE_MAP: Record<string, string> = {
  hy: 'hy-AM',
  ru: 'ru-RU',
  en: 'en-US',
};

// Armenian is missing from the ICU data in several of the runtimes we ship to — notably the
// browser build, where `Intl.DateTimeFormat.supportedLocalesOf(['hy-AM'])` comes back empty and
// `hy-AM` silently resolves to `ru`. Every date in the Armenian UI was rendering as
// "21 июл. 2026 г.". Detected rather than assumed, so a runtime that does carry Armenian ICU
// (native builds usually do) keeps using the real thing and its own conventions.
const HAS_ARMENIAN_ICU = (() => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(['hy-AM']).length > 0;
  } catch {
    return false;
  }
})();

// Genitive, which is the case Armenian uses when a day precedes the month
// ("21 հուլիսի 2026 թ."). The standalone list below is nominative, for a month on its own.
const HY_MONTHS_GENITIVE = [
  'հունվարի', 'փետրվարի', 'մարտի', 'ապրիլի', 'մայիսի', 'հունիսի',
  'հուլիսի', 'օգոստոսի', 'սեպտեմբերի', 'հոկտեմբերի', 'նոյեմբերի', 'դեկտեմբերի',
];

const HY_MONTHS_NOMINATIVE = [
  'հունվար', 'փետրվար', 'մարտ', 'ապրիլ', 'մայիս', 'հունիս',
  'հուլիս', 'օգոստոս', 'սեպտեմբեր', 'հոկտեմբեր', 'նոյեմբեր', 'դեկտեմբեր',
];

// "թ." is the Armenian year marker, the equivalent of the Russian "г.".
const HY_YEAR_SUFFIX = 'թ.';

export function usesArmenianFallback(language: string): boolean {
  return language === 'hy' && !HAS_ARMENIAN_ICU;
}

function twoDigits(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatDate(value: string | Date, language: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (usesArmenianFallback(language)) {
    return `${date.getDate()} ${HY_MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} ${HY_YEAR_SUFFIX}`;
  }
  return date.toLocaleDateString(LOCALE_MAP[language] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// period is 'YYYY-MM'
export function formatMonth(period: string, language: string): string {
  const [year, month] = period.split('-').map(Number);
  if (usesArmenianFallback(language)) {
    return `${HY_MONTHS_NOMINATIVE[month - 1]} ${year} ${HY_YEAR_SUFFIX}`;
  }
  return new Date(year, month - 1, 1).toLocaleDateString(LOCALE_MAP[language] ?? 'en-US', {
    year: 'numeric',
    month: 'long',
  });
}

export function formatDateTime(value: string | Date, language: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (usesArmenianFallback(language)) {
    const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
    return `${formatDate(date, language)}, ${time}`;
  }
  return date.toLocaleString(LOCALE_MAP[language] ?? 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
