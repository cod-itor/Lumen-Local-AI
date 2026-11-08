"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { SystemStatusDto } from "@/types/api";

/** GET /api/system/status (API_CONTRACT §4.11): which host features exist. null = not loaded yet. */
type Features = SystemStatusDto["ai"]["features"];
type StatusCtx = { features: Features | null; refresh: () => void };

const OFF: Features = {
  hostChat: false, images: false, bgRemoval: false, voice: false, tts: false, translation: false, webSearch: false,
  guardClassifier: false,
};

const Ctx = createContext<StatusCtx | null>(null);

export function StatusProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<Features | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api
      .get<SystemStatusDto>("/api/system/status")
      .then((s) => alive && setFeatures(s.ai.features))
      .catch(() => alive && setFeatures(OFF));
    return () => {
      alive = false;
    };
  }, [tick]);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const value = useMemo(() => ({ features, refresh }), [features, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStatus() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStatus must be used inside <StatusProvider>");
  return ctx;
}

/** Same as useStatus, but null outside the app shell (e.g. the landing page's static composer). */
export function useOptionalStatus() {
  return useContext(Ctx);
}
