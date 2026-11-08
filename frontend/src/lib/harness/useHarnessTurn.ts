"use client";

import { useCallback, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { providerRegistry } from "@/lib/providers/registry";
import { describeProviderError, type ClientModelProvider, type GenerateDone, type ProviderErrorKind } from "@/lib/providers/types";
import { postSse } from "@/lib/sse";
import type {
  AbstainedEvent,
  ApprovalEvent,
  BlockedEvent,
  ChatMessage,
  CompleteTurnRequest,
  ErrorEvent,
  FinishReason,
  HarnessTurnRequest,
  MessageDto,
  PreparedEvent,
  ProviderDto,
  RetryEvent,
  StatusEvent,
  TurnDto,
  TurnResult,
  TurnStartedEvent,
  TurnStage,
} from "@/types/api";
import { createClientGuard, stripReasoning } from "./clientGuard";

/**
 * One harness turn at a time (FRONTEND.md §4).
 * SERVER generation: POST /api/harness/turns and read the SSE stream; Stop = POST /cancel and keep reading.
 * CLIENT generation (browser WebLLM / the visitor's Ollama): the stream ends with `prepared`, this browser generates,
 * then POST /complete runs the server's output pipeline (422 SCHEMA_INVALID → generate again with repair messages).
 */
export type TurnPhase = "idle" | "loadingModel" | "running";

export type TurnFailure = {
  code: string;
  message: string;
  retryable: boolean;
  userMessageId: string | null;
  /** Set for PROVIDER_ERROR: what went wrong with the browser-side model. */
  providerError?: ProviderErrorKind;
};

export type TurnUi = {
  phase: TurnPhase;
  stage: TurnStage | null;
  stageDetail: string | null;
  retryReason: RetryEvent["reason"] | null;
  /** Streamed visible text of the current attempt (reasoning removed). */
  text: string;
  turnId: string | null;
  /** WebLLM download/load progress (0–1). */
  modelProgress: { p: number; text: string } | null;
  /** Web search waits for the user to approve or edit the query (HARNESS.md §7.4). */
  approval: { turnId: string; query: string } | null;
};

export type ApprovalDecision = { decision: "APPROVE" } | { decision: "EDIT"; content: string };

export type TurnHandlers = {
  onUserMessage?: (m: MessageDto) => void;
  onAssistantMessage?: (m: MessageDto) => void;
  /** The stream broke but the turn finished on the server: reload the chat. */
  onReload?: () => void;
  onFailure?: (f: TurnFailure) => void;
  /** Stopped before any text: nothing was saved. */
  onCancelled?: () => void;
};

const IDLE: TurnUi = {
  phase: "idle", stage: null, stageDetail: null, retryReason: null, text: "", turnId: null, modelProgress: null, approval: null,
};
const TERMINAL = new Set(["COMPLETED", "BLOCKED", "ABSTAINED", "CANCELLED", "EXPIRED", "FAILED"]);

type Mode = "none" | "loading" | "stream" | "client" | "approval";

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** Resolves with the promise, or rejects with AbortError when the signal fires first (the promise keeps running). */
function untilAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export function useHarnessTurn() {
  const [ui, setUi] = useState<TurnUi>(IDLE);
  const turnIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<Mode>("none");
  const stopRef = useRef(false);
  const runningRef = useRef(false);
  const approvalRef = useRef<((d: ApprovalDecision | null) => void) | null>(null);

  const start = useCallback(async (req: HarnessTurnRequest, h: TurnHandlers = {}, provider?: ProviderDto | null) => {
    if (runningRef.current) return;
    runningRef.current = true;
    stopRef.current = false;
    turnIdRef.current = null;
    const abort = new AbortController();
    abortRef.current = abort;
    let userMessageId: string | null = req.answerOf ?? null;
    const fail = (e: ErrorEvent & { providerError?: ProviderErrorKind }) => h.onFailure?.({ ...e, userMessageId });
    const progress = (p: number, text: string) => setUi((u) => ({ ...u, modelProgress: { p, text } }));

    const cancelTurn = async () => {
      if (turnIdRef.current) {
        await api.post(`/api/harness/turns/${turnIdRef.current}/cancel`, { reason: "USER" }).catch(() => undefined);
      }
      h.onCancelled?.();
    };

    const clientFailed = async (err: unknown) => {
      const d = describeProviderError(err);
      if (turnIdRef.current) {
        await api
          .post(`/api/harness/turns/${turnIdRef.current}/cancel`, { reason: "CLIENT_ERROR", errorCode: "PROVIDER_ERROR" })
          .catch(() => undefined);
      }
      fail({ code: "PROVIDER_ERROR", message: "", retryable: true, providerError: d.kind });
    };

    /** Applies a TurnResult (from `done` or from `complete`). */
    const finish = (r: TurnResult) => {
      if (r.message) h.onAssistantMessage?.(r.message);
      else if (r.status === "CANCELLED") h.onCancelled?.();
      else fail({ code: r.status, message: r.notice ?? "", retryable: true });
    };

    const clientGenerate = async (
      client: ClientModelProvider,
      prep: PreparedEvent,
      extra: ChatMessage[],
      attempt: number,
      autoRetried = false,
    ): Promise<void> => {
      if (!client.isReady()) {
        modeRef.current = "loading";
        setUi((u) => ({ ...u, phase: "loadingModel" }));
        try {
          await untilAbort(client.ensureReady(progress), abort.signal);
        } catch (e) {
          if (isAbort(e) || stopRef.current) return cancelTurn();
          return clientFailed(e);
        }
      }
      if (stopRef.current) return cancelTurn();

      modeRef.current = "client";
      const gen = new AbortController();
      genAbortRef.current = gen;
      setUi((u) => ({ ...u, phase: "running", stage: "GENERATING", text: "", modelProgress: null }));
      const guard = createClientGuard(prep.clientGuard);
      const started = performance.now();
      let raw = "";
      let visible = "";
      let guardReason: FinishReason | null = null;
      let done: GenerateDone | null = null;
      try {
        const it = client.generate({
          messages: [...prep.messages, ...extra],
          params: prep.params,
          schema: prep.outputSchema,
          profile: prep.modelProfile,
          signal: gen.signal,
        });
        for (;;) {
          const r = await it.next();
          if (r.done) {
            done = r.value;
            break;
          }
          raw += r.value.text;
          visible = stripReasoning(raw);
          const shown = visible;
          setUi((u) => ({ ...u, text: shown, retryReason: null }));
          const g = guard.check(visible);
          if (g) {
            guardReason = g.reason;
            gen.abort();
            await it.return?.(undefined as never).catch(() => undefined);
            break;
          }
        }
      } catch (e) {
        if (!isAbort(e) && !gen.signal.aborted) {
          if (raw === "" && !autoRetried && !stopRef.current) return clientGenerate(client, prep, extra, attempt, true);
          return clientFailed(e);
        }
      } finally {
        genAbortRef.current = null;
      }

      const finishReason: FinishReason = guardReason ?? (stopRef.current ? "ABORTED" : (done?.finishReason ?? "ABORTED"));
      if (finishReason === "ABORTED" && (req.task !== "MESSAGE" || visible.trim() === "")) return cancelTurn();

      const stats: CompleteTurnRequest["stats"] = done?.stats ?? {
        model: client.model, ttftMs: null, tokensPerSec: null, outputTokens: null, promptTokens: null,
        totalMs: Math.round(performance.now() - started),
      };
      setUi((u) => ({ ...u, stage: "CHECKING_OUTPUT" }));
      modeRef.current = "none";
      try {
        const body: CompleteTurnRequest = { content: raw, finishReason, stats, attempt };
        finish(await api.post<TurnResult>(`/api/harness/turns/${prep.turnId}/complete`, body));
      } catch (e) {
        if (e instanceof ApiError && e.status === 422 && e.code === "SCHEMA_INVALID") {
          const d = (e.details ?? {}) as { attemptsLeft?: number; reason?: RetryEvent["reason"]; repairMessages?: ChatMessage[] };
          if ((d.attemptsLeft ?? 0) > 0 && !stopRef.current) {
            setUi((u) => ({ ...u, text: "", retryReason: d.reason ?? "INVALID" }));
            return clientGenerate(client, prep, [...extra, ...(d.repairMessages ?? [])], attempt + 1);
          }
        }
        if (e instanceof ApiError) fail({ code: e.code, message: e.status === 410 ? "" : e.message, retryable: true });
        else await recover(turnIdRef.current, h, fail);
      }
    };

    try {
      // A browser model downloads/loads BEFORE the turn exists, so the turn's lifetime and the chat lock are not used up.
      let client: ClientModelProvider | null = null;
      if (provider && provider.generation === "CLIENT") {
        try {
          client = await providerRegistry.get(provider);
        } catch (e) {
          return fail({ code: "PROVIDER_ERROR", message: "", retryable: true, providerError: describeProviderError(e).kind });
        }
        if (!client.isReady()) {
          modeRef.current = "loading";
          setUi({ ...IDLE, phase: "loadingModel" });
          try {
            await untilAbort(client.ensureReady(progress), abort.signal);
          } catch (e) {
            if (isAbort(e) || stopRef.current) return h.onCancelled?.();
            return fail({ code: "PROVIDER_ERROR", message: "", retryable: true, providerError: describeProviderError(e).kind });
          }
          if (stopRef.current) return h.onCancelled?.();
        }
      }

      modeRef.current = "stream";
      setUi({ ...IDLE, phase: "running" });
      let terminal = false;
      let url = "/api/harness/turns";
      let body: unknown = req;
      // One stream, or two when web search waits for approval (the second continues from SEARCHING).
      for (;;) {
      terminal = false;
      let approval: { turnId: string; query: string } | null = null;
      const events = await postSse(url, body, abort.signal);
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
            if (stopRef.current) void api.post(`/api/harness/turns/${d.turnId}/cancel`, { reason: "USER" }).catch(() => undefined);
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
          case "done":
            terminal = true;
            finish(data as TurnResult);
            break;
          case "blocked": {
            terminal = true;
            const d = data as BlockedEvent;
            if (d.message) h.onAssistantMessage?.(d.message);
            else fail({ code: "GUARD_BLOCKED", message: d.refusal, retryable: false });
            break;
          }
          case "abstained":
            terminal = true;
            h.onAssistantMessage?.((data as AbstainedEvent).message);
            break;
          case "cancelled":
            terminal = true;
            h.onCancelled?.();
            break;
          case "error":
            terminal = true;
            fail(data as ErrorEvent);
            break;
          case "prepared": {
            terminal = true;
            const prep = data as PreparedEvent;
            turnIdRef.current = prep.turnId;
            if (!client) {
              await clientFailed(new Error("This model has to run in the browser."));
              break;
            }
            if (stopRef.current) {
              await cancelTurn();
              break;
            }
            await clientGenerate(client, prep, [], prep.attempt);
            break;
          }
          case "approval": {
            terminal = true;
            const d = data as ApprovalEvent;
            approval = { turnId: d.turnId, query: d.content };
            break;
          }
        }
        if (terminal) break;
      }
      if (!terminal) {
        await recover(turnIdRef.current, h, fail);
        break;
      }
      if (!approval) break;
      const asked: { turnId: string; query: string } = approval;
      modeRef.current = "approval";
      setUi((u) => ({ ...u, approval: asked, stage: null, text: "" }));
      const decision = stopRef.current
        ? null
        : await new Promise<ApprovalDecision | null>((resolve) => (approvalRef.current = resolve));
      approvalRef.current = null;
      setUi((u) => ({ ...u, approval: null, stage: decision ? "SEARCHING" : u.stage }));
      if (!decision) {
        await cancelTurn();
        break;
      }
      modeRef.current = "stream";
      url = `/api/harness/turns/${asked.turnId}/approval`;
      body = decision;
      }
    } catch (e) {
      if (isAbort(e)) {
        if (turnIdRef.current) await recover(turnIdRef.current, h, fail, true);
        else h.onCancelled?.();
      } else if (e instanceof ApiError) {
        fail({ code: e.code, message: e.message, retryable: e.status !== 400 && e.status !== 404 });
      } else {
        await recover(turnIdRef.current, h, fail);
      }
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      genAbortRef.current = null;
      modeRef.current = "none";
      setUi(IDLE);
    }
  }, []);

  const stop = useCallback(async () => {
    stopRef.current = true;
    const mode = modeRef.current;
    if (mode === "approval") {
      approvalRef.current?.(null);
      return;
    }
    if (mode === "loading") {
      // The model keeps loading in the background for next time; only the wait ends.
      abortRef.current?.abort();
      return;
    }
    if (mode === "client") {
      genAbortRef.current?.abort();
      return;
    }
    const id = turnIdRef.current;
    if (!id) {
      abortRef.current?.abort();
      return;
    }
    // SERVER: keep reading — the stream ends with `done` (partial answer saved as STOPPED) or `cancelled`.
    await api.post(`/api/harness/turns/${id}/cancel`, { reason: "USER" }).catch(() => undefined);
    setTimeout(() => {
      if (modeRef.current === "stream" && turnIdRef.current === id) abortRef.current?.abort();
    }, 5000);
  }, []);

  /** Answer a pending web search approval (no-op when none is pending). */
  const respond = useCallback((d: ApprovalDecision) => approvalRef.current?.(d), []);

  return { ui, start, stop, respond, busy: ui.phase !== "idle" };
}

/** Stream closed without a terminal event (API_CONTRACT §5): ask the server what happened. */
async function recover(
  turnId: string | null,
  h: TurnHandlers,
  fail: (e: ErrorEvent) => void,
  stopped = false,
) {
  if (turnId) {
    for (let i = 0; i < 3; i++) {
      const t = await api.get<TurnDto>(`/api/harness/turns/${turnId}`).catch(() => null);
      if (t && TERMINAL.has(t.status)) {
        h.onReload?.();
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    // Free the chat lock so Retry is not refused with 409.
    await api.post(`/api/harness/turns/${turnId}/cancel`, { reason: "USER" }).catch(() => undefined);
    h.onReload?.();
  }
  if (stopped) h.onCancelled?.();
  else fail({ code: "STREAM_INTERRUPTED", message: "", retryable: true });
}
