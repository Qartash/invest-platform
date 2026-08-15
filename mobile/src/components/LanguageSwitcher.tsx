import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';
import { SegmentedTabs } from './ui';

// Picking a language and picking a theme are the same kind of choice, so they use the same
// control. Two differently-shaped chip rows sitting together under "Оформление" read as two
// unrelated widgets rather than one settings block.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <SegmentedTabs
      active={i18n.language as SupportedLanguage}
      onChange={(language: SupportedLanguage) => changeLanguage(language)}
      tabs={SUPPORTED_LANGUAGES.map((language) => ({ key: language, label: LANGUAGE_LABELS[language] }))}
    />
  );
}
