"use client";

import { useCallback, useRef, useState } from "react";
import { runTask, type TaskOutcome } from "@/lib/harness/runTask";
import { useSession } from "@/lib/session";
import type { HarnessTurnRequest } from "@/types/api";

/** Runs one learning task (LEARN_QUESTION/PLAN/STEP, QUIZ) with the session's model; one at a time. */
export function useLearnTask() {
  const session = useSession();
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (req: Omit<HarnessTurnRequest, "providerId">): Promise<TaskOutcome | null> => {
      const provider = session.provider;
      if (!provider) {
        setError({ code: "NO_MODEL", message: "" });
        return null;
      }
      if (running.current) return null;
      running.current = true;
      setError(null);
      setStage("PREPARING");
      try {
        const out = await runTask({ ...req, providerId: provider.id } as HarnessTurnRequest, provider, {
          onProgress: (p) => setStage(p.stage ?? null),
        });
        if (!out.ok) setError({ code: out.code, message: out.message });
        else if (out.result.status !== "COMPLETED") {
          setError({ code: out.result.status, message: out.result.notice ?? "" });
          return { ok: false, code: out.result.status, message: out.result.notice ?? "", retryable: true };
        }
        return out;
      } finally {
        running.current = false;
        setStage(null);
      }
    },
    [session.provider],
  );

  return { run, stage, busy: stage !== null, error, clearError: () => setError(null) };
}
