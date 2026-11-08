/**
 * Shared domain types. Mock data (src/mocks) and services (src/services) both
 * conform to these, so swapping mocks for a real API only touches src/services.
 */

import type { Localized } from "@/i18n/config";

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
  /** Status line under the name ("EmbeddingGemma loaded · Queue 0"). The state label comes from the dictionary. */
  detail: Localized<string>;
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
  label: Localized<string>;
};
