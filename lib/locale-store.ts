import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Locale, defaultLocale, locales } from './i18n';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: defaultLocale,
      setLocale: (locale: Locale) => {
        if (locales.includes(locale)) {
          set({ locale });
          // Update html lang attribute
          if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
          }
        }
      },
    }),
    {
      name: 'locale-storage',
      onRehydrateStorage: () => (state) => {
        // Update html lang on rehydration
        if (state?.locale && typeof document !== 'undefined') {
          document.documentElement.lang = state.locale;
        }
      },
    }
  )
);
