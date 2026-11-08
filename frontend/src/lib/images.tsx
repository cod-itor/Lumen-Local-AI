"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, apiFetch } from "@/lib/api";
import { readSse } from "@/lib/sse";
import type { ImageSessionDto, JobDto, PageResponse, SystemStatusDto } from "@/types/api";

/** Image sessions (sidebar Recents) + the AI features that decide what the Image tab offers. */
type ImagesCtx = {
  sessions: ImageSessionDto[];
  loaded: boolean;
  features: { images: boolean; bgRemoval: boolean } | null;
  upsert: (s: ImageSessionDto) => void;
  remove: (id: string) => Promise<void>;
  refreshStatus: () => void;
};

const Ctx = createContext<ImagesCtx | null>(null);

export function ImagesProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ImageSessionDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [features, setFeatures] = useState<ImagesCtx["features"]>(null);
  const [statusTick, setStatusTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get<PageResponse<ImageSessionDto>>("/api/image-sessions?size=50")
      .then((p) => alive && setSessions(p.items))
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get<SystemStatusDto>("/api/system/status")
      .then((s) => alive && setFeatures({ images: s.ai.features.images, bgRemoval: s.ai.features.bgRemoval }))
      .catch(() => alive && setFeatures({ images: false, bgRemoval: false }));
    return () => {
      alive = false;
    };
  }, [statusTick]);

  const upsert = useCallback((s: ImageSessionDto) => {
    setSessions((list) => [s, ...list.filter((x) => x.id !== s.id)]);
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.del(`/api/image-sessions/${id}`);
    setSessions((list) => list.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(
    () => ({ sessions, loaded, features, upsert, remove, refreshStatus: () => setStatusTick((n) => n + 1) }),
    [sessions, loaded, features, upsert, remove],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useImages() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useImages must be used inside <ImagesProvider>");
  return ctx;
}

/** Follow an image job until it ends; resubscribes once per drop while the job is still open. */
export async function followJob(
  jobId: string,
  onProgress: (progress: number, stage: string | null) => void,
): Promise<JobDto | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/events`, { headers: { Accept: "text/event-stream" } });
      for await (const { event, data } of readSse(res)) {
        if (event === "progress") {
          const d = data as { progress: number; stage?: string };
          onProgress(d.progress, d.stage ?? null);
        } else if (event === "done" || event === "error") break;
      }
    } catch {
      // fall through to the status check
    }
    const job = await api.get<JobDto>(`/api/jobs/${jobId}`).catch(() => null);
    if (!job || (job.status !== "QUEUED" && job.status !== "RUNNING")) return job;
  }
  return api.get<JobDto>(`/api/jobs/${jobId}`).catch(() => null);
}
