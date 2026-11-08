import { CreateWebWorkerMLCEngine, prebuiltAppConfig, type WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import { applyProfile } from "./messages";
import type { ClientModelProvider, GenerateDone, LoadProgress } from "./types";

/** One WebLLM engine for the page; one model loaded at a time (FRONTEND.md §3.4). */
let engine: WebWorkerMLCEngine | null = null;
let loadedId: string | null = null;
let loading: Promise<WebWorkerMLCEngine> | null = null;
let loadingId: string | null = null;
const listeners = new Set<LoadProgress>();

export const appConfig = { ...prebuiltAppConfig, cacheBackend: "cache" as const };

async function load(modelId: string): Promise<WebWorkerMLCEngine> {
  const progress = (r: { progress: number; text: string }) => listeners.forEach((l) => l(r.progress, r.text));
  if (engine) {
    engine.setInitProgressCallback(progress);
    await engine.reload(modelId);
    return engine;
  }
  const worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
  return CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback: progress, appConfig });
}

export async function getEngine(modelId: string, onProgress?: LoadProgress) {
  if (engine && loadedId === modelId) return engine;
  if (onProgress) listeners.add(onProgress);
  try {
    if (!loading || loadingId !== modelId) {
      loadingId = modelId;
      loading = load(modelId).then((e) => {
        engine = e;
        loadedId = modelId;
        return e;
      });
      loading.catch(() => undefined).finally(() => {
        if (loadingId === modelId) {
          loading = null;
          loadingId = null;
        }
      });
    }
    return await loading;
  } finally {
    if (onProgress) listeners.delete(onProgress);
  }
}

export const isLoaded = (modelId: string) => engine !== null && loadedId === modelId;

type Usage = { completion_tokens?: number; prompt_tokens?: number; extra?: { decode_tokens_per_s?: number } };

export function webllmProvider(modelId: string): ClientModelProvider {
  return {
    kind: "BROWSER",
    model: modelId,
    async ensureReady(onProgress) {
      await getEngine(modelId, onProgress);
    },
    isReady: () => isLoaded(modelId),
    async *generate({ messages, params, schema, profile, signal }) {
      const eng = await getEngine(modelId);
      const started = performance.now();
      const onAbort = () => eng.interruptGenerate();
      signal.addEventListener("abort", onAbort, { once: true });
      try {
        const stream = await eng.chat.completions.create({
          messages: applyProfile(messages, profile),
          stream: true,
          stream_options: { include_usage: true },
          temperature: params.temperature,
          top_p: params.topP,
          max_tokens: params.maxTokens,
          stop: params.stop.length ? params.stop : undefined,
          repetition_penalty: params.repeatPenalty,
          seed: params.seed ?? undefined,
          ...(schema && profile.jsonSchema ? { response_format: { type: "json_object" as const, schema: JSON.stringify(schema) } } : {}),
          ...(profile.disableThinking === "WEBLLM_EXTRA_BODY" ? { extra_body: { enable_thinking: false } } : {}),
        });
        let usage: Usage | null = null;
        let finish: string | null = null;
        let ttft: number | null = null;
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            ttft ??= performance.now() - started;
            yield { text: delta };
          }
          finish = chunk.choices[0]?.finish_reason ?? finish;
          if (chunk.usage) usage = chunk.usage as Usage;
        }
        const tps = usage?.extra?.decode_tokens_per_s;
        const out: GenerateDone = {
          finishReason: signal.aborted || finish === "abort" ? "ABORTED" : finish === "length" ? "LENGTH" : "STOP",
          stats: {
            model: modelId,
            ttftMs: ttft === null ? null : Math.round(ttft),
            outputTokens: usage?.completion_tokens ?? null,
            promptTokens: usage?.prompt_tokens ?? null,
            tokensPerSec: tps ? +tps.toFixed(1) : null,
            totalMs: Math.round(performance.now() - started),
          },
        };
        return out;
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}
