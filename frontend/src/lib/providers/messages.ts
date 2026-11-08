import type { ChatMessage, ModelProfile } from "@/types/api";

/** Models without a system role get the system text merged into the first user message (FRONTEND.md §3.2). */
export function applyProfile(messages: ChatMessage[], profile: ModelProfile): ChatMessage[] {
  if (profile.systemRole || messages[0]?.role !== "system") return messages;
  const [system, ...rest] = messages;
  const i = rest.findIndex((m) => m.role === "user");
  if (i < 0) return [{ role: "user", content: system.content }];
  const merged: ChatMessage = { role: "user", content: `[Instructions]\n${system.content}\n\n[Message]\n${rest[i].content}` };
  return [...rest.slice(0, i), merged, ...rest.slice(i + 1)];
}
