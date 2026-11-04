import type { Localized } from "@/i18n/config";

/**
 * Chat conversation types (Figma "02 · Chat · Answer", "03 · Chat · Sources open").
 * Mock data in src/mocks/conversations.ts and src/services/chat.ts conform to these.
 */

/** Tint of the round favicon in the "N sources" chip. */
export type SourceTone = "neutral" | "teal" | "yellow" | "blue" | "orange";

/** Figma "Card/Source". */
export type Source = {
  id: string;
  /** 1-based number shown on the card. */
  index: number;
  /** Short label used for inline citations ("Khan Academy"). */
  citeLabel: string;
  /** Letter favicon ("W"). */
  letter: string;
  tone: SourceTone;
  domain: string; // "en.wikipedia.org"
  title: string;
  snippet: string;
  url: string;
};

/** A run of inline content inside an answer paragraph or list item. */
export type InlineSegment =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "cite"; sourceId: string };

export type AnswerBlock =
  | { type: "paragraph"; content: InlineSegment[] }
  | { type: "list"; items: InlineSegment[][] }
  /** Mono block with a header label and a copy button ("equation"). */
  | { type: "code"; label: string; code: string };

export type UserMessage = { id: string; role: "user"; text: string };

export type AssistantMessage = {
  id: string;
  role: "assistant";
  /** "Searched 4 sites" (app chrome, so localized). Omit when the answer didn't use web search. */
  searchTrace?: Localized<string>;
  blocks: AnswerBlock[];
  /** Sources cited by this answer (ids into Conversation.sources). */
  sourceIds: string[];
};

export type ChatMessage = UserMessage | AssistantMessage;

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  sources: Source[];
  /** "Search steps" card in the sources panel (app chrome, so localized). */
  searchSteps: Localized<string[]>;
  /** The only text that left the device, shown under the search steps. */
  searchQuery: string;
};
