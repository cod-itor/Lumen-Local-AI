/** First prompt typed on /chat, handed to the new chat page after navigation (kept in memory only). */
const pending = new Map<string, { text: string; webSearch: boolean }>();

export function setPendingPrompt(chatId: string, text: string, webSearch: boolean) {
  pending.set(chatId, { text, webSearch });
}

export function takePendingPrompt(chatId: string) {
  const p = pending.get(chatId);
  pending.delete(chatId);
  return p ?? null;
}
