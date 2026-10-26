import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
import type { LanguagePref } from '@/state/prefs';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'ar' ? 'ar' : 'en';
}

export const resolveLanguage = (pref: LanguagePref): Language => (pref === 'system' ? deviceLanguage() : pref);

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export const isRTLLanguage = (lang: string) => lang === 'ar';

/** True when the UI language reads right to left. The root layout flips the whole tree from this. */
export function useIsRTL(): boolean {
  return isRTLLanguage(useTranslation().i18n.language);
}

/**
 * Style for the root of a tree (the app, or a Modal, which renders outside the app's tree) that lays it
 * out in the UI direction. Native uses Yoga's `direction`; the web uses the page's `dir` attribute instead.
 */
export function useDirectionStyle(): { direction?: 'rtl' | 'ltr' } {
  const rtl = useIsRTL();
  return Platform.OS === 'web' ? {} : { direction: rtl ? 'rtl' : 'ltr' };
}

/** A row that stays left to right in Arabic too, e.g. the letters of a room code. */
export function useLtrRow(): 'row' | 'row-reverse' {
  return useIsRTL() ? 'row-reverse' : 'row';
}

export default i18n;
