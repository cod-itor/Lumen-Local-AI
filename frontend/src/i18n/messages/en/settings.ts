/** English — "settings" strings. Keys here are the source of truth; km/settings.ts mirrors them. */
export const settings = {
  title: "Settings",
  navAria: "Settings sections",
  nav: {
    howItWorks: "How Lumen’s AI works",
    models: "Models by job",
    installed: "Installed models",
    setup: "Setup guide",
    guardrails: "Rules & guardrails",
    privacy: "What leaves your device",
    language: "Language",
    appearance: "Appearance",
    account: "Account",
  },
  models: {
    title: "Models by job",
    description:
      "Lumen uses a different model for each kind of work. Pick which of your installed models does each job — anything you installed that fits will show up.",
  },
  installed: {
    title: "Installed models",
    description: "What Lumen found on this computer. Remove models in Ollama to free disk space.",
    roles: {
      chat: "Learning & chat",
      embedding: "Documents · embeddings",
      image: "Images",
    },
  },
  setup: {
    title: "Setup guide",
    description: "New computer? Five steps and Lumen is ready.",
  },
  guardrails: {
    title: "Rules & guardrails",
    description:
      "Whatever model you install, Lumen wraps it in the same rules. This is exactly what each model is told and allowed to do.",
    appliesTo: "Applies to: {target}",
  },
  privacy: {
    title: "What leaves your device",
    description: "Where each feature runs, and exactly what (if anything) goes online.",
    feature: "Feature",
    runsOn: "Runs on",
    leaves: "Leaves your device",
    comingSoon: "Coming soon: use the models on your laptop from your phone —",
    comingSoonProduct: "Lumen Desktop & Remote Access",
  },
  language: {
    title: "Language",
    label: "App language",
  },
  appearance: {
    title: "Appearance",
    theme: "Theme",
    themeHint: "Dark is the default.",
    dark: "Dark",
    light: "Light",
    chatWidth: "Chat width",
    chatWidthHint: "How wide conversations are",
    adjust: "Adjust",
  },
  account: {
    title: "Account",
    logOut: "Log out",
  },
  runtime: {
    connected: "Connected to {name}",
    notFound: "{name} not found",
    details: "Running on this computer · {host} · v{version}",
    checking: "Checking…",
    checkAgain: "Check again",
  },
  state: {
    ready: "Ready",
    downloading: "Downloading",
    missing: "Not installed",
  },
  roles: {
    usedIn: "Used in",
    fromChat: "from Learning & chat",
    slotFor: "{slot} for {role}",
    chooseModel: "Choose a model",
    noneInstalled: "None installed",
    installedHere: "Installed on this computer",
    downloadingProgress: "Downloading · {progress}%",
    mustHave: "The model must",
    tools: "Tools it can call",
    pipeline: "How a question is answered",
    install: "Install",
    alternatives: "Other models that work",
  },
  copyCommand: "Copy command: {command}",
  chatWidth: {
    title: "Chat width",
    description: "Drag or swipe to resize the conversation. It updates live behind this panel.",
    width: "Width",
    presets: {
      narrow: "Narrow",
      default: "Default",
      wide: "Wide",
      full: "Full",
    },
  },
};

export type SettingsMessages = typeof settings;
