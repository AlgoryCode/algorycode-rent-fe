"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type AppLocale,
  localeFromNavigatorLang,
  parseStoredLocale,
} from "@/lib/i18n/locales";
import { type MessageKey, translate } from "@/lib/i18n/messages";

const LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function writeLocaleCookie(next: AppLocale) {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${LOCALE_STORAGE_KEY}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE_SEC};samesite=lax`;
  } catch {
    /* ignore */
  }
}

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readClientPreferredLocale(serverGuess: AppLocale): AppLocale {
  const stored = parseStoredLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;
  return localeFromNavigatorLang(window.navigator.language) ?? serverGuess;
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  /** Sunucu HTML ile ilk boyama eşleşsin diye çerezden (RootLayout). */
  initialLocale?: AppLocale;
}) {
  const serverGuess = initialLocale ?? DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState<AppLocale>(() => serverGuess);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const preferred = readClientPreferredLocale(serverGuess);
    if (preferred !== serverGuess) {
      setLocaleState(preferred);
    }
    setReady(true);
  }, [serverGuess]);

  useEffect(() => {
    if (!ready || typeof document === "undefined") return;
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* private mode */
    }
    writeLocaleCookie(locale);
  }, [locale, ready]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    writeLocaleCookie(next);
  }, []);

  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

/** Dil seçicisi gibi; tüm uygulama metinleri için `useLocale` tercih edin. */
export function useLocaleOptional(): LocaleContextValue | null {
  return useContext(LocaleContext);
}
