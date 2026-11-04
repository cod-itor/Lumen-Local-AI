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
  /** Sidebar section headings. */
  sections: { pinned: string; recents: string };
  pinned: string[];
  recents: { title: string; active?: boolean }[];
  tabs: { label: string; icon: string; active?: boolean }[];
  message: LandingPreviewMessage;
  composerPlaceholder: string;
  /** Composer's web-search chip. */
  search: string;
  disclaimer: string;
};

export type ShowcaseSceneId = "chat" | "learn" | "image" | "docs";

export type ShowcaseScene = {
  id: ShowcaseSceneId;
  /** Rail pill label. */
  label: string;
  icon: string;
  title: string;
  description: string;
  /** What gets typed into the composer and sent. */
  prompt: string;
  /** Index into preview.tabs that's active. */
  tab: number;
  /** Index into preview.nav that's highlighted, or -1. */
  nav: number;
  /** Sidebar item (pinned or recent title) that's highlighted. */
  recent: string;
  model: string;
  modelDetail: string;
  /** Floating callout beside the window. */
  chip: { label: string; icon: string };
};

/** Scroll-driven product demo under the hero: one scene per workspace. */
export type LandingShowcase = {
  railLabel: string;
  thinking: string;
  scenes: ShowcaseScene[];
  learn: {
    path: string;
    stepOf: string;
    steps: string[];
    current: number;
    quizLabel: string;
    question: string;
    options: string[];
    correct: number;
    correctLabel: string;
    unlocked: string;
  };
  image: {
    improvedLabel: string;
    improvedPrompt: string;
    approve: string;
    edit: string;
    generating: string;
    images: string[];
    doneLabel: string;
  };
  docs: {
    usingLabel: string;
    searching: string;
    files: string[];
    answer: string;
    citation: string;
    fileName: string;
    fileMeta: string;
    heading: string;
    before: string;
    highlight: string;
    after: string;
  };
};

export type LandingContent = {
  nav: LandingLink[];
  hero: {
    badge: string;
    title: [string, string];
    subtitle: string;
    primaryCta: LandingLink;
    secondaryCta: LandingLink;
    languagesLabel: string; // "Language" label beside the switcher
  };
  preview: LandingPreview;
  showcase: LandingShowcase;
  /** Small UI labels used by landing components. */
  ui: {
    logIn: string;
    getStarted: string;
    home: string;
  };
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
