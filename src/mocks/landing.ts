import type { LandingContent } from "@/types/landing";

export const mockLanding: LandingContent = {
  nav: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Privacy", href: "#privacy" },
    { label: "About", href: "#about" },
  ],
  hero: {
    badge: "Runs 100% on your own machine",
    title: ["Your private AI", "study partner"],
    subtitle:
      "Runs locally and speaks Khmer and English. Chat with sources, ask your own documents, create images and learn step by step, without your data leaving your computer.",
    primaryCta: { label: "Get started, it’s free", href: "/signup" },
    secondaryCta: { label: "See how it works", href: "#how-it-works", icon: "landing-play" },
    languagesLabel: "Answers in",
    languages: [
      { id: "en", label: "English" },
      { id: "km", label: "ខ្មែរ", lang: "km" },
      { id: "both", label: "Both" },
    ],
  },
  preview: {
    model: "Gemma 4 E2B",
    modelState: "Ready",
    modelDetail: "EmbeddingGemma loaded · Queue 0",
    user: { name: "Sokha Kim", initials: "SK", plan: "Student · Free" },
    nav: [
      { label: "New chat", icon: "nav-plus" },
      { label: "Search", icon: "nav-search" },
      { label: "Projects", icon: "nav-projects", active: true, trailing: true },
      { label: "Learning paths", icon: "nav-cap" },
    ],
    pinned: ["Khmer grammar: verb tenses", "Exam prep · Biology"],
    recents: [
      { title: "Photosynthesis explained simply", active: true },
      { title: "Python loops practice quiz" },
      { title: "World War II timeline" },
      { title: "Coffee shop poster ideas" },
      { title: "Learn Python · Step 3" },
      { title: "Essay outline: climate change" },
    ],
    tabs: [
      { label: "Chat", icon: "msg", active: true },
      { label: "Documents", icon: "file" },
      { label: "Image", icon: "image" },
    ],
    message: {
      question: "Explain how photosynthesis works in simple terms.",
      searchTrace: "Searched 4 sites",
      intro: {
        text: "Photosynthesis is how plants make their own food. They use sunlight as energy to turn water and carbon dioxide into sugar, and give off oxygen along the way.",
        source: "Wikipedia",
      },
      bullets: [
        { title: "Light.", text: "Chlorophyll in the leaves captures sunlight." },
        {
          title: "Water and CO₂.",
          text: "Roots pull up water and leaves take in carbon dioxide.",
          source: "Khan Academy",
        },
        {
          title: "Food and oxygen.",
          text: "The plant makes glucose and releases oxygen.",
          source: "Nat Geo",
        },
      ],
      code: { label: "equation", content: "6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂" },
      followUp: "Want a quick quiz to check your understanding?",
      sources: [
        { letter: "W", tone: "muted" },
        { letter: "K", tone: "teal" },
        { letter: "N", tone: "yellow" },
      ],
      sourcesLabel: "4 sources",
    },
    composerPlaceholder: "Ask a follow-up",
    composerTypingPrompts: [
      "Can you quiz me on photosynthesis?",
      "ពន្យល់ពីរស្មីសំយោគជាភាសាខ្មែរ",
      "Summarize chapter 2 of my biology notes",
      "Draw a poster for our science fair",
      "What is the difference between a list and a tuple?",
    ],
    disclaimer: "AI can make mistakes. Check sources.",
    floatChips: [
      { label: "Answer cites 4 web sources", icon: "landing-check" },
      { label: "Translated to Khmer in one tap", icon: "landing-lang" },
    ],
  },
  features: {
    eyebrow: "FEATURES",
    title: "One assistant. Four ways to learn.",
    subtitle:
      "Pick a workspace in the middle of the screen. Each one is tuned for a single job, so small local models still give great results.",
    items: [
      {
        id: "chat",
        title: "Chat with sources",
        description:
          "Ask anything and get clear answers. Turn on web search to see numbered citations and source cards beside the answer.",
        chip: "[1] [2] citations",
        icon: "landing-feature-globe",
        href: "/chat/photosynthesis",
      },
      {
        id: "documents",
        title: "Ask your documents",
        description:
          "Upload lecture PDFs and notes. Every answer quotes the exact paragraph and highlights it in the document viewer.",
        chip: "PDF · DOCX · TXT · MD",
        icon: "landing-feature-file",
        href: "/documents",
      },
      {
        id: "image",
        title: "Create images",
        description:
          "Describe an idea, approve the improved prompt, then remove backgrounds or make variations for slides and posters.",
        chip: "Background removal",
        icon: "landing-feature-image",
        href: "/image",
      },
      {
        id: "learn",
        title: "Learn step by step",
        description:
          "Tell it your goal. It asks a few questions, builds a plan you approve, then quizzes you at every step.",
        chip: "Next step unlocks at 70%",
        icon: "landing-feature-cap",
        href: "/learn",
      },
    ],
  },
  steps: {
    eyebrow: "HOW IT WORKS",
    title: "You stay in control, every step",
    items: [
      {
        number: "01",
        title: "Ask or upload",
        description: "Type, speak or drop in your notes. Choose English, Khmer or both for the answer.",
      },
      {
        number: "02",
        title: "Review before it runs",
        description:
          "Image prompts, web searches and learning plans show a preview you can approve, edit or cancel.",
      },
      {
        number: "03",
        title: "Learn and check",
        description:
          "Get cited answers, translate any message, and practise with quizzes that track your progress.",
      },
    ],
  },
  privacy: {
    eyebrow: "PRIVACY",
    title: ["Runs locally.", "Stays private."],
    body: "Lumen runs small, fast models on your own computer with Ollama. Your chats, notes and images are stored on your machine, not in someone else’s cloud.",
    points: [
      "Models run on your own laptop, with no account needed for AI",
      "Chats and documents never leave your machine",
      "Web search is optional, and the app shows exactly what was sent",
      "Honest about limits: sources, regenerate and edit on every answer",
    ],
    stats: [
      { value: "~2B", label: "parameter models" },
      { value: "16 GB", label: "laptop is enough" },
      { value: "0", label: "chats uploaded" },
    ],
    stack: [
      { title: "Your browser", description: "Open the website, nothing to install", icon: "landing-monitor" },
      {
        title: "Lumen on your laptop",
        description: "Accounts, history and files stay local",
        icon: "landing-lock",
      },
      {
        title: "Local models",
        description: "Loaded on demand, one heavy job at a time",
        icon: "landing-cpu",
        models: ["Gemma 4 E2B", "EmbeddingGemma", "FLUX.2 klein", "faster-whisper", "NLLB-200"],
      },
    ],
    note: "Optional web search sends only the query, and the app shows it",
  },
  cta: {
    title: "Start learning with your own private AI",
    subtitle: "Free to use. No data leaves your computer. Works in English and Khmer.",
    primary: { label: "Get started, it’s free", href: "/signup" },
    secondary: { label: "Log in", href: "/login" },
  },
  footer: {
    tagline: "Your private AI study partner",
    links: [
      { label: "GitHub", href: "https://github.com", icon: "landing-code", external: true },
      { label: "Team", href: "#about" },
      { label: "About", href: "#about" },
      { label: "Privacy", href: "#privacy" },
    ],
    disclaimer: "AI can make mistakes. Check sources.",
    copyright: "© 2026 Lumen · Built by students",
  },
};
