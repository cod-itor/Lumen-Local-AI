import "server-only";
import { mockChatHistory, mockChatSuggestions } from "@/mocks/chats";
import { mockModelStatus, mockSectionModels } from "@/mocks/models";
import { mockUser } from "@/mocks/user";
import type { AppSection, ChatSummary, ModelStatus, Suggestion, User } from "@/types";

// Swap each body for `apiFetch(...)` (see ./api.ts) when the backend is ready.

export async function getCurrentUser(): Promise<User> {
  return mockUser;
}

export async function getChatHistory(): Promise<ChatSummary[]> {
  return mockChatHistory;
}

export async function getChatSuggestions(): Promise<Suggestion[]> {
  return mockChatSuggestions;
}

export async function getSectionModels(): Promise<Record<AppSection, string | null>> {
  return mockSectionModels;
}

export async function getModelStatuses(): Promise<Record<AppSection, ModelStatus>> {
  return mockModelStatus;
}
