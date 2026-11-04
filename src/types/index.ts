/**
 * Shared domain types. Mock data (src/mocks) and services (src/services) both
 * conform to these, so swapping mocks for a real API only touches src/services.
 */

export type User = {
  id: string;
  name: string;
  initials: string;
  plan: string; // e.g. "Student · Free"
};

export type ModelState = "ready" | "loading" | "idle";

export type ModelStatus = {
  name: string; // "Gemma 4 E2B"
  state: ModelState;
  stateLabel: string; // "Ready"
  detail: string; // "EmbeddingGemma loaded · Queue 0"
};

export type AppSection = "chat" | "documents" | "image" | "learn";

export type ChatSummary = {
  id: string;
  title: string;
  pinned?: boolean;
  /** Where this history item navigates. Defaults to /chat/[id]. */
  href?: string;
};

export type Suggestion = {
  id: string;
  label: string;
};
