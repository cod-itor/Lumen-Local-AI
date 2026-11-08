/** English — strings shared across pages. km/common.ts mirrors these keys. */
export const common = {
  notFound: {
    title: "This page doesn't exist",
    body: "The link may be old or mistyped. Nothing about your account changed.",
    back: "Go back to Lumen",
  },
  language: "Language",
  languageHint: "Changes every page instantly. Saved on this device.",
  backToLumen: "Back to Lumen",
  lumenHome: "Lumen home",
  switchToLight: "Switch to light mode",
  switchToDark: "Switch to dark mode",
  copy: "Copy",
  copied: "Copied",
  close: "Close",
  cancel: "Cancel",
  done: "Done",
  reset: "Reset",
  open: "Open",
  comingSoon: "Coming soon",
  comingSoonAria: "Coming soon: planned features",
  aiDisclaimer: "AI can make mistakes. Check sources.",
};

export type CommonMessages = typeof common;
