/**
 * Languages. English is the default; Khmer (km) is fully translated.
 * The choice is stored per browser (localStorage + a cookie the backend can
 * read later) and applied before first paint, so pages never flash English.
 */
export const LOCALES = ["en", "km"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_KEY = "lumen:locale";

export const LOCALE_LABEL: Record<Locale, { native: string; english: string; short: string }> = {
  en: { native: "English", english: "English", short: "En" },
  km: { native: "ខ្មែរ", english: "Khmer", short: "Kh" },
};

/** Content that exists in every language; pick with useLocalized(). */
export type Localized<T> = Record<Locale, T>;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/**
 * Inline, constant <head> script (no user input): sets <html lang> from the
 * saved choice and hides the page for the moment until React renders it in
 * that language. A timeout un-hides it even if scripts fail.
 */
export const localeBootScript = `try{var l=localStorage.getItem("${LOCALE_KEY}");if(l&&l!=="${DEFAULT_LOCALE}"&&${JSON.stringify(LOCALES)}.indexOf(l)>-1){var d=document.documentElement;d.lang=l;d.setAttribute("data-i18n-pending","");setTimeout(function(){d.removeAttribute("data-i18n-pending")},1500)}}catch(e){}`;
