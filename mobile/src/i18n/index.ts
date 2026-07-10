import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import hy from './locales/hy.json';
import ru from './locales/ru.json';
import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['hy', 'ru', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  hy: 'Հայերեն',
  ru: 'Русский',
  en: 'English',
};
const LANGUAGE_STORAGE_KEY = 'app_language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'hy';

const resources = {
  hy: { translation: hy },
  ru: { translation: ru },
  en: { translation: en },
};

function detectDeviceLanguage(): SupportedLanguage {
  const deviceLanguage = Localization.getLocales()[0]?.languageCode;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLanguage ?? '')
    ? (deviceLanguage as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

export async function initI18n(): Promise<void> {
  const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const language = (SUPPORTED_LANGUAGES as readonly string[]).includes(storedLanguage ?? '')
    ? (storedLanguage as SupportedLanguage)
    : detectDeviceLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export default i18n;
