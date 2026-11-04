import type { ChatSummary, Suggestion } from "@/types";

/** Sidebar history for the Chat / Learn sections. */
export const mockChatHistory: ChatSummary[] = [
  { id: "khmer-grammar", title: "Khmer grammar: verb tenses", pinned: true },
  { id: "exam-prep-biology", title: "Exam prep · Biology", pinned: true },
  { id: "photosynthesis", title: "Photosynthesis explained simply" },
  { id: "python-loops-quiz", title: "Python loops practice quiz" },
  { id: "ww2-timeline", title: "World War II timeline" },
  { id: "coffee-poster", title: "Coffee shop poster ideas" },
  { id: "learn-python-3", title: "Learn Python · Step 3", href: "/learn" },
  { id: "climate-essay", title: "Essay outline: climate change" },
];

/** Starter chips under the composer on the empty chat screen. */
export const mockChatSuggestions: Suggestion[] = [
  { id: "s1", label: { en: "Explain photosynthesis", km: "ពន្យល់ពីរស្មីសំយោគ" } },
  { id: "s2", label: { en: "Quiz me on Python", km: "សួរខ្ញុំអំពី Python" } },
  { id: "s3", label: { en: "Summarize my notes", km: "សង្ខេបកំណត់ត្រារបស់ខ្ញុំ" } },
  { id: "s4", label: { en: "Translate to Khmer", km: "បកប្រែជាភាសាខ្មែរ" } },
];
