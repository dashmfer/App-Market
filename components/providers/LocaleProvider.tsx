"use client";

import { ReactNode, useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useLocaleStore } from "@/lib/locale-store";
import { getMessages, defaultLocale } from "@/lib/i18n";

interface LocaleProviderProps {
  children: ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const locale = useLocaleStore((state) => state.locale);
  const [messages, setMessages] = useState(() => getMessages(defaultLocale));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      setMessages(getMessages(locale));
    }
  }, [locale, mounted]);

  return (
    <NextIntlClientProvider
      locale={mounted ? locale : defaultLocale}
      messages={messages}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );
}
