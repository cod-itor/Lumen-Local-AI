"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { runTask } from "@/lib/harness/runTask";
import type { EvalMode, EvalResultDto, EvalRunDetailDto, EvalRunDto, ProviderDto } from "@/types/api";

/**
 * Model Test runner (FRONTEND.md §7.7). A module-level store, not page state: the run keeps going while the visitor
 * moves around the app. Cases run one at a time as EVAL_CASE turns; a failed case is retried once; the backend stores
 * error results and decides when the run is COMPLETED or FAILED.
 */
export type RunnerState = {
  runId: string | null;
  providerId: string | null;
  running: boolean;
  current: string | null;
  stage: string | null;
  modelProgress: number | null;
  done: number;
  total: number;
  lastError: string | null;
};

const INITIAL: RunnerState = {
  runId: null, providerId: null, running: false, current: null, stage: null, modelProgress: null, done: 0, total: 0,
  lastError: null,
};

let state: RunnerState = INITIAL;
let abort: AbortController | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<RunnerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useEvalRunner(): RunnerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => INITIAL,
  );
}

export async function startRun(provider: ProviderDto, mode: EvalMode): Promise<EvalRunDto> {
  const run = await api.post<EvalRunDto>("/api/evals/runs", { providerId: provider.id, suite: "core", mode });
  void loop(run.id, provider);
  return run;
}

export function resumeRun(runId: string, provider: ProviderDto) {
  void loop(runId, provider);
}

/** Pause = stop looping; the run stays RUNNING on the server and can be resumed. */
export function pauseRun() {
  abort?.abort();
}

export async function cancelRun(runId: string) {
  abort?.abort();
  await api.post<EvalRunDto>(`/api/evals/runs/${runId}/cancel`);
}

async function loop(runId: string, provider: ProviderDto) {
  if (state.running) return;
  const ctrl = new AbortController();
  abort = ctrl;
  set({ ...INITIAL, runId, providerId: provider.id, running: true });
  try {
    let detail = await api.get<EvalRunDetailDto>(`/api/evals/runs/${runId}`);
    const passedOnce = (r: EvalResultDto | undefined) => r !== undefined && r.error === null;
    set({ total: detail.caseIds.length, done: detail.results.length });
    for (const caseId of detail.caseIds) {
      if (ctrl.signal.aborted || detail.status !== "RUNNING") break;
      if (passedOnce(detail.results.find((r) => r.caseId === caseId))) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (ctrl.signal.aborted) break;
        set({ current: caseId, stage: null, modelProgress: null });
        const out = await runTask(
          { task: "EVAL_CASE", providerId: provider.id, target: { type: "EVAL_RUN", id: runId }, taskInput: { caseId } },
          provider,
          {
            signal: ctrl.signal,
            onProgress: (p) => set({ stage: p.stage ?? state.stage, modelProgress: p.modelProgress ?? null }),
          },
        );
        if (out.ok) break;
        set({ lastError: out.code });
        if (out.code === "CONFLICT" || out.code === "CANCELLED") break;
      }
      detail = await api.get<EvalRunDetailDto>(`/api/evals/runs/${runId}`);
      set({ done: detail.results.length });
    }
  } catch (e) {
    set({ lastError: e instanceof Error ? e.message : String(e) });
  } finally {
    if (abort === ctrl) abort = null;
    set({ running: false, current: null, stage: null, modelProgress: null });
  }
}
