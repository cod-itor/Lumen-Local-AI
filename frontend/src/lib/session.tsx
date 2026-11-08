"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChatDto, MeResponse, PageResponse, ProviderDto } from "@/types/api";

/**
 * The signed-in user's live data for the app shell: profile + settings, the Chat-tab history and the model
 * providers. Loaded once in the browser through the /api proxy; pages update it after they change something.
 */
type Session = {
  me: MeResponse | null;
  chats: ChatDto[];
  providers: ProviderDto[];
  /** The provider turns use: the default one, else the first. */
  provider: ProviderDto | null;
  loading: boolean;
  error: ApiError | null;
  reloadChats: () => Promise<void>;
  /** Insert or move a chat to the top (after a message was sent or it was renamed). */
  touchChat: (chat: ChatDto) => void;
  removeChat: (id: string) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [chats, setChats] = useState<ChatDto[]>([]);
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const reloadChats = useCallback(async () => {
    const page = await api.get<PageResponse<ChatDto>>("/api/chats?tab=CHAT&size=50");
    setChats(page.items);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<MeResponse>("/api/auth/me"),
      api.get<PageResponse<ChatDto>>("/api/chats?tab=CHAT&size=50"),
      api.get<ProviderDto[]>("/api/providers"),
    ])
      .then(([m, c, p]) => {
        if (!alive) return;
        setMe(m);
        setChats(c.items);
        setProviders(p);
      })
      .catch((e: unknown) => alive && setError(e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", String(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<Session>(
    () => ({
      me,
      chats,
      providers,
      provider: providers.find((p) => p.isDefault) ?? providers[0] ?? null,
      loading,
      error,
      reloadChats,
      touchChat: (chat) => setChats((list) => [chat, ...list.filter((c) => c.id !== chat.id)]),
      removeChat: (id) => setChats((list) => list.filter((c) => c.id !== id)),
      logout: async () => {
        await api.post("/api/auth/logout").catch(() => undefined);
        // Full reload on purpose: nothing of the old session stays in memory.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      },
    }),
    [me, chats, providers, loading, error, reloadChats],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Short model label for the picker ("llama3.2" → "Llama 3.2"). */
export function modelLabel(p: ProviderDto | null) {
  if (!p) return null;
  const m = p.model.replace(/:latest$/, "");
  const pretty = m.replace(/^llama(\d)/i, "Llama $1").replace(/^gemma(\d)/i, "Gemma $1").replace(/^qwen/i, "Qwen ");
  return p.kind === "HOST" ? pretty : `${pretty} · ${p.kind === "BROWSER" ? "browser" : "local"}`;
}
