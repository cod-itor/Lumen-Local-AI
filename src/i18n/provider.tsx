"use client";

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_KEY, type Locale, type Localized } from "./config";
import { format, lookup, MESSAGES, type MessageKey, type Messages } from "./messages";

/* Tiny external store: the locale lives outside React so every client
   component (and the <html lang>) updates together, without a provider. */
const listeners = new Set<() => void>();
let current: Locale | null = null;

function read(): Locale {
  if (current) return current;
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    current = isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    current = DEFAULT_LOCALE;
  }
  return current;
}

export function setLocale(locale: Locale) {
  current = locale;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* storage blocked — keep it for this visit */
  }
  // Readable by the server later (e.g. emails, server-rendered pages).
  document.cookie = `${LOCALE_KEY.replace(":", "-")}=${locale}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_LOCALE);
}

/** Typed messages object for the current language: `const m = useMessages(); m.auth.login.title`. */
export function useMessages(): Messages {
  return MESSAGES[useLocale()];
}

/** Translate dotted keys at runtime (for keys that travel as data, e.g. validation errors). */
export function useTranslate() {
  const messages = useMessages();
  return (key: string, vars?: Record<string, string | number>) => {
    const s = lookup(messages, key);
    return vars ? format(s, vars) : s;
  };
}

/** Pick the current language's version of localized content. */
export function useLocalized<T>(bundle: Localized<T>): T {
  return bundle[useLocale()];
}

/** A translated string, usable from server components: <T k="auth.login.title" />. */
export function T({ k, vars }: { k: MessageKey; vars?: Record<string, string | number> }) {
  const t = useTranslate();
  return <>{t(k, vars)}</>;
}

/** Same as <T>, for localized data passed down from the server. */
export function L<V extends ReactNode>({ bundle }: { bundle: Localized<V> }) {
  return <>{useLocalized(bundle)}</>;
}

/**
 * Mounted once in the root layout: keeps <html lang> in sync and lifts the
 * boot-time "pending" veil once the saved language has rendered.
 */
export function LocaleSync() {
  const locale = useLocale();
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.removeAttribute("data-i18n-pending");
  }, [locale]);
  return null;
}
