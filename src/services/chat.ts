import "server-only";
import { cache } from "react";
import { mockConversations, mockPhotosynthesisConversation } from "@/mocks/conversations";
import type { Conversation } from "@/types/chat";
import { getChatHistory } from "./app";

// Swap the body for `apiFetch<Conversation>(`/chats/${id}`)` (see ./api.ts) when the backend is ready.

/**
 * One conversation by id, or `null` if it doesn't exist.
 * Static prototype: history items without an authored conversation get their
 * title as the question and the sample photosynthesis answer, so every sidebar link works.
 */
export const getConversation = cache(async (id: string): Promise<Conversation | null> => {
  const authored = mockConversations[id];
  if (authored) return authored;

  const summary = (await getChatHistory()).find((c) => c.id === id);
  if (!summary) return null;

  const sample = mockPhotosynthesisConversation;
  return {
    ...sample,
    id: summary.id,
    title: summary.title,
    messages: sample.messages.map((m) => (m.role === "user" ? { ...m, text: summary.title } : m)),
  };
});
