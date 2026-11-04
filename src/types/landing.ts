/** Types for the marketing landing page (route `/`). */

export type LandingLink = {
  label: string;
  href: string;
  /** Icon name from /public/icons (rendered with <Icon />). */
  icon?: string;
  external?: boolean;
};

export type LandingFeature = {
  id: string;
  title: string;
  description: string;
  chip: string;
  icon: string;
  href: string;
};

export type LandingStep = {
  number: string;
  title: string;
  description: string;
};

export type LandingStat = {
  value: string;
  label: string;
};

export type LandingStackLayer = {
  title: string;
  description: string;
  icon: string;
  /** Highlighted layer (primary fill) with model chips. */
  models?: string[];
};

export type LandingLanguage = {
  id: "en" | "km" | "both";
  label: string;
  lang?: string;
};

export type LandingPreviewMessage = {
  question: string;
  searchTrace: string;
  intro: { text: string; source: string };
  bullets: { title: string; text: string; source?: string }[];
  code: { label: string; content: string };
  followUp: string;
  sources: { letter: string; tone: "muted" | "teal" | "yellow" }[];
  sourcesLabel: string;
};

export type LandingPreview = {
  model: string;
  modelState: string;
  modelDetail: string;
  user: { name: string; initials: string; plan: string };
  nav: { label: string; icon: string; active?: boolean; trailing?: boolean }[];
  pinned: string[];
  recents: { title: string; active?: boolean }[];
  tabs: { label: string; icon: string; active?: boolean }[];
  message: LandingPreviewMessage;
  composerPlaceholder: string;
  /** Example questions typed into the preview composer, in order. */
  composerTypingPrompts: string[];
  disclaimer: string;
  floatChips: { label: string; icon: string }[];
};

export type LandingContent = {
  nav: LandingLink[];
  hero: {
    badge: string;
    title: [string, string];
    subtitle: string;
    primaryCta: LandingLink;
    secondaryCta: LandingLink;
    languagesLabel: string;
    languages: LandingLanguage[];
  };
  preview: LandingPreview;
  features: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: LandingFeature[];
  };
  steps: {
    eyebrow: string;
    title: string;
    items: LandingStep[];
  };
  privacy: {
    eyebrow: string;
    title: [string, string];
    body: string;
    points: string[];
    stats: LandingStat[];
    stack: LandingStackLayer[];
    note: string;
  };
  cta: {
    title: string;
    subtitle: string;
    primary: LandingLink;
    secondary: LandingLink;
  };
  footer: {
    tagline: string;
    links: LandingLink[];
    disclaimer: string;
    copyright: string;
  };
};
