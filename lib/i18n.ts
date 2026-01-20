export const locales = ['en', 'es', 'fr', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Espanol',
  fr: 'Francais',
  zh: '中文',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  zh: '🇨🇳',
};

export function getMessages(locale: Locale) {
  try {
    return require(`@/messages/${locale}.json`);
  } catch {
    return require(`@/messages/${defaultLocale}.json`);
  }
}
