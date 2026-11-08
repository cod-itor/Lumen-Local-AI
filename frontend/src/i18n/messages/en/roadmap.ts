/** English — "roadmap" strings. Keys here are the source of truth; km/roadmap.ts mirrors them. */
export const roadmap = {
  updated: "Roadmap · updated {date}",
  status: {
    done: "Done",
    inProgress: "In progress",
    planned: "Planned",
  },
  bigPicture: {
    eyebrow: "The big picture",
    title: "Three pieces, one conversation",
    subtitle: "Watch a message travel — the box doing the work lights up.",
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "From install to remote control",
    firstRun: "First run on the laptop",
  },
  preview: {
    eyebrow: "What users will see",
    title: "Online, offline and setup",
    subtitle: "A preview of the planned website states. Illustrative only.",
  },
  changes: {
    eyebrow: "What changes",
    title: "Today vs. the plan",
    area: "Area",
    today: "Today",
    planned: "Planned",
    todayLabel: "Today: ",
  },
  tech: {
    eyebrow: "Recommended tech",
    title: "What we’ll build it with",
    pairing: "Device pairing",
  },
  tradeOffs: {
    eyebrow: "Trade-offs",
    title: "Know before we start",
  },
  buildOrder: {
    eyebrow: "Build order",
    title: "Ship it in small steps",
    subtitle: "Start with chat only through the relay, then add documents and images.",
  },
  notes: {
    eyebrow: "Planning notes",
    title: "Details to decide later",
    subtitle: "Added while writing this down — suggestions, not decisions.",
    tableBefore: "",
    tableAfter: " table (Postgres)",
    column: "Column",
    type: "Type",
    why: "Why",
    protocol: "Relay messages (sketch)",
    security: "Security checklist",
    openQuestions: "Open questions",
  },
  journey: {
    title: "How one message travels",
    subtitle: "From your phone to your laptop and back, in six steps.",
    play: "Play",
    pause: "Pause",
    announce: "Step {n}: {title}. {detail}",
    actors: {
      website: "Website",
      backend: "Backend",
      desktop: "Desktop app",
    },
  },
  diagram: {
    label: "Architecture: website, cloud backend and desktop app",
  },
  devices: {
    settings: "Settings → Devices",
    inChat: "In a chat",
    laptopName: "Sokha’s MacBook",
    laptopMeta: "Gemma 4 E2B ready · seen just now",
    pcName: "Home PC",
    pcMeta: "Last seen 2 hours ago",
    online: "Online",
    offline: "Offline",
    offlineTitle: "Your computer is offline",
    offlineBody: "Open Lumen Desktop on Sokha’s MacBook to keep chatting. Your history is still here.",
    setup: "Desktop setup · Downloading Gemma 4 E2B",
    size: "2.1 / 3.2 GB",
  },
};

export type RoadmapMessages = typeof roadmap;
