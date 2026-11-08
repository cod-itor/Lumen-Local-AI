"use client";

import { useCallback, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { postSse } from "@/lib/sse";
import type {
  AbstainedEvent,
  BlockedEvent,
  ErrorEvent,
  HarnessTurnRequest,
  MessageDto,
  RetryEvent,
  StatusEvent,
  TurnDto,
  TurnResult,
  TurnStartedEvent,
  TurnStage,
} from "@/types/api";

/**
 * One harness turn at a time (FRONTEND.md §4), SERVER generation: POST /api/harness/turns, read the SSE stream,
 * Stop = POST /cancel and keep reading. CLIENT generation (browser / local Ollama) is added with phase 5.
 */
export type TurnPhase = "idle" | "running";

export type TurnFailure = { code: string; message: string; retryable: boolean; userMessageId: string | null };

export type TurnUi = {
  phase: TurnPhase;
  stage: TurnStage | null;
  stageDetail: string | null;
  retryReason: RetryEvent["reason"] | null;
  /** Streamed visible text of the current attempt. */
  text: string;
  turnId: string | null;
};

export type TurnHandlers = {
  onUserMessage?: (m: MessageDto) => void;
  onAssistantMessage?: (m: MessageDto) => void;
  /** The stream broke but the turn finished on the server: reload the chat. */
  onReload?: () => void;
  onFailure?: (f: TurnFailure) => void;
  /** Stopped before any text: nothing was saved. */
  onCancelled?: () => void;
};

const IDLE: TurnUi = { phase: "idle", stage: null, stageDetail: null, retryReason: null, text: "", turnId: null };
const TERMINAL = new Set(["COMPLETED", "BLOCKED", "ABSTAINED", "CANCELLED", "EXPIRED", "FAILED"]);

export function useHarnessTurn() {
  const [ui, setUi] = useState<TurnUi>(IDLE);
  const turnIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  const start = useCallback(async (req: HarnessTurnRequest, h: TurnHandlers = {}) => {
    if (runningRef.current) return;
    runningRef.current = true;
    turnIdRef.current = null;
    const abort = new AbortController();
    abortRef.current = abort;
    setUi({ ...IDLE, phase: "running" });
    let userMessageId: string | null = req.answerOf ?? null;
    let terminal = false;
    const fail = (e: ErrorEvent) => h.onFailure?.({ ...e, userMessageId });

    try {
      const events = await postSse("/api/harness/turns", req, abort.signal);
      for await (const { event, data } of events) {
        switch (event) {
          case "turn": {
            const d = data as TurnStartedEvent;
            turnIdRef.current = d.turnId;
            if (d.userMessage) {
              userMessageId = d.userMessage.id;
              h.onUserMessage?.(d.userMessage);
            }
            setUi((u) => ({ ...u, turnId: d.turnId }));
            break;
          }
          case "status": {
            const d = data as StatusEvent;
            setUi((u) => ({ ...u, stage: d.stage, stageDetail: d.detail ?? null }));
            break;
          }
          case "token": {
            const t = (data as { text: string }).text;
            setUi((u) => ({ ...u, text: u.text + t, stage: "GENERATING", retryReason: null }));
            break;
          }
          case "retry": {
            const d = data as RetryEvent;
            setUi((u) => ({ ...u, text: "", retryReason: d.reason }));
            break;
          }
          case "done": {
            terminal = true;
            const r = data as TurnResult;
            if (r.message) h.onAssistantMessage?.(r.message);
            else if (r.status === "CANCELLED") h.onCancelled?.();
            else fail({ code: r.status, message: r.notice ?? "No answer was saved.", retryable: true });
            break;
          }
          case "blocked": {
            terminal = true;
            const d = data as BlockedEvent;
            if (d.message) h.onAssistantMessage?.(d.message);
            else fail({ code: "GUARD_BLOCKED", message: d.refusal, retryable: false });
            break;
          }
          case "abstained": {
            terminal = true;
            h.onAssistantMessage?.((data as AbstainedEvent).message);
            break;
          }
          case "cancelled":
            terminal = true;
            h.onCancelled?.();
            break;
          case "error":
            terminal = true;
            fail(data as ErrorEvent);
            break;
          case "prepared":
            // Browser / local-Ollama generation arrives in phase 5: end this turn cleanly so the chat is not locked.
            terminal = true;
            if (turnIdRef.current) {
              await api
                .post(`/api/harness/turns/${turnIdRef.current}/cancel`, { reason: "CLIENT_ERROR", errorCode: "CLIENT_UNSUPPORTED" })
                .catch(() => undefined);
            }
            fail({ code: "CLIENT_UNSUPPORTED", message: "", retryable: false });
            break;
          case "approval":
            terminal = true;
            break;
        }
        if (terminal) break;
      }
      if (!terminal) await recover(turnIdRef.current, h, fail);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") h.onCancelled?.();
      else if (e instanceof ApiError) fail({ code: e.code, message: e.message, retryable: e.status !== 400 && e.status !== 404 });
      else await recover(turnIdRef.current, h, fail);
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      setUi(IDLE);
    }
  }, []);

  const stop = useCallback(async () => {
    const id = turnIdRef.current;
    if (!id) {
      abortRef.current?.abort();
      return;
    }
    // Keep reading: the stream ends with `done` (partial answer saved as STOPPED) or `cancelled`.
    await api.post(`/api/harness/turns/${id}/cancel`, { reason: "USER" }).catch(() => undefined);
  }, []);

  return { ui, start, stop, busy: ui.phase === "running" };
}

/** Stream closed without a terminal event (API_CONTRACT §5): ask the server what happened. */
async function recover(turnId: string | null, h: TurnHandlers, fail: (e: ErrorEvent) => void) {
  if (turnId) {
    const t = await api.get<TurnDto>(`/api/harness/turns/${turnId}`).catch(() => null);
    if (t && TERMINAL.has(t.status)) {
      h.onReload?.();
      return;
    }
  }
  fail({ code: "STREAM_INTERRUPTED", message: "", retryable: true });
}
