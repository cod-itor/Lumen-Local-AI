import { api, ApiError } from "@/lib/api";
import { providerRegistry } from "@/lib/providers/registry";
import { describeProviderError, type ClientModelProvider, type GenerateDone } from "@/lib/providers/types";
import { postSse } from "@/lib/sse";
import type {
  BlockedEvent,
  ChatMessage,
  CompleteTurnRequest,
  ErrorEvent,
  FinishReason,
  HarnessTurnRequest,
  PreparedEvent,
  ProviderDto,
  TurnResult,
} from "@/types/api";
import { createClientGuard, stripReasoning } from "./clientGuard";

/**
 * One non-MESSAGE harness turn outside React (Model Test cases, learning, quizzes, image prompts).
 * Same protocol as useHarnessTurn: SERVER providers stream until `done`; CLIENT providers end with `prepared`,
 * generate in this browser, then POST /complete (422 SCHEMA_INVALID → generate again with the repair messages).
 */
export type TaskOutcome =
  | { ok: true; result: TurnResult }
  | { ok: false; code: string; message: string; retryable: boolean };

export type TaskProgress = { stage?: string; modelProgress?: number };

export async function runTask(
  req: HarnessTurnRequest,
  provider: ProviderDto,
  opts: { signal?: AbortSignal; onProgress?: (p: TaskProgress) => void } = {},
): Promise<TaskOutcome> {
  const { signal, onProgress } = opts;
  let client: ClientModelProvider | null = null;
  try {
    if (provider.generation === "CLIENT") {
      client = await providerRegistry.get(provider);
      if (!client.isReady()) await client.ensureReady((p) => onProgress?.({ stage: "LOADING_MODEL", modelProgress: p }));
    }
  } catch (e) {
    return { ok: false, code: "PROVIDER_ERROR", message: describeProviderError(e).kind, retryable: true };
  }

  let turnId: string | null = null;
  try {
    const events = await postSse("/api/harness/turns", req, signal);
    for await (const { event, data } of events) {
      switch (event) {
        case "turn":
          turnId = (data as { turnId: string }).turnId;
          break;
        case "status":
          onProgress?.({ stage: (data as { stage: string }).stage });
          break;
        case "done":
          return { ok: true, result: data as TurnResult };
        case "blocked":
          return { ok: false, code: "GUARD_BLOCKED", message: (data as BlockedEvent).refusal, retryable: false };
        case "cancelled":
          return { ok: false, code: "CANCELLED", message: "", retryable: true };
        case "error": {
          const e = data as ErrorEvent;
          return { ok: false, code: e.code, message: e.message, retryable: e.retryable };
        }
        case "prepared": {
          const prep = data as PreparedEvent;
          turnId = prep.turnId;
          if (!client) return { ok: false, code: "PROVIDER_ERROR", message: "", retryable: true };
          return await clientTurn(client, prep, req.task, signal, onProgress);
        }
      }
    }
    return { ok: false, code: "STREAM_INTERRUPTED", message: "", retryable: true };
  } catch (e) {
    if (turnId) await api.post(`/api/harness/turns/${turnId}/cancel`, { reason: "USER" }).catch(() => undefined);
    if (e instanceof ApiError) return { ok: false, code: e.code, message: e.message, retryable: e.status >= 500 };
    if (e instanceof DOMException && e.name === "AbortError") return { ok: false, code: "CANCELLED", message: "", retryable: true };
    return { ok: false, code: "STREAM_INTERRUPTED", message: "", retryable: true };
  }
}

async function clientTurn(
  client: ClientModelProvider,
  prep: PreparedEvent,
  task: HarnessTurnRequest["task"],
  signal: AbortSignal | undefined,
  onProgress: ((p: TaskProgress) => void) | undefined,
): Promise<TaskOutcome> {
  let extra: ChatMessage[] = [];
  let attempt = prep.attempt;
  for (;;) {
    onProgress?.({ stage: "GENERATING" });
    const gen = new AbortController();
    const onAbort = () => gen.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const guard = createClientGuard(prep.clientGuard);
    const started = performance.now();
    let raw = "";
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
        const g = guard.check(stripReasoning(raw));
        if (g) {
          guardReason = g.reason;
          gen.abort();
          await it.return?.(undefined as never).catch(() => undefined);
          break;
        }
      }
    } catch (e) {
      if (!gen.signal.aborted) {
        await api
          .post(`/api/harness/turns/${prep.turnId}/cancel`, { reason: "CLIENT_ERROR", errorCode: "PROVIDER_ERROR" })
          .catch(() => undefined);
        return { ok: false, code: "PROVIDER_ERROR", message: describeProviderError(e).kind, retryable: true };
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    if (signal?.aborted) {
      await api.post(`/api/harness/turns/${prep.turnId}/cancel`, { reason: "USER" }).catch(() => undefined);
      return { ok: false, code: "CANCELLED", message: "", retryable: true };
    }
    const finishReason: FinishReason = guardReason ?? done?.finishReason ?? "STOP";
    const stats: CompleteTurnRequest["stats"] = done?.stats ?? {
      model: client.model, ttftMs: null, tokensPerSec: null, outputTokens: null, promptTokens: null,
      totalMs: Math.round(performance.now() - started),
    };
    onProgress?.({ stage: "CHECKING_OUTPUT" });
    try {
      const body: CompleteTurnRequest = { content: raw, finishReason, stats, attempt };
      return { ok: true, result: await api.post<TurnResult>(`/api/harness/turns/${prep.turnId}/complete`, body) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.code === "SCHEMA_INVALID" && task !== "EVAL_CASE") {
        const d = (e.details ?? {}) as { attemptsLeft?: number; repairMessages?: ChatMessage[] };
        if ((d.attemptsLeft ?? 0) > 0) {
          extra = [...extra, ...(d.repairMessages ?? [])];
          attempt += 1;
          continue;
        }
      }
      if (e instanceof ApiError) return { ok: false, code: e.code, message: e.message, retryable: true };
      return { ok: false, code: "STREAM_INTERRUPTED", message: "", retryable: true };
    }
  }
}
