import type { ChatMessage, GenParams, ModelProfile } from "@/types/api";

/** Browser-side model providers (FRONTEND.md §3.1). */
export interface GenerateRequest {
  messages: ChatMessage[];
  params: GenParams;
  schema: object | null;
  profile: ModelProfile;
  signal: AbortSignal;
}
export interface GenerateChunk { text: string }
export interface GenerateDone {
  finishReason: "STOP" | "LENGTH" | "ABORTED";
  stats: {
    model: string;
    ttftMs: number | null;
    tokensPerSec: number | null;
    outputTokens: number | null;
    promptTokens: number | null;
    totalMs: number | null;
  };
}
export type LoadProgress = (p: number, text: string) => void;

export interface ClientModelProvider {
  kind: "BROWSER" | "LOCAL_OLLAMA";
  model: string;
  /** Downloads/loads the model (WebLLM); a no-op for Ollama. */
  ensureReady(onProgress?: LoadProgress): Promise<void>;
  /** True when the model is already loaded and a turn can start without a wait. */
  isReady(): boolean;
  generate(req: GenerateRequest): AsyncGenerator<GenerateChunk, GenerateDone>;
}

/** Why a browser-side model failed, mapped to a translated message in the UI. */
export type ProviderErrorKind = "OLLAMA_UNREACHABLE" | "MODEL_NOT_FOUND" | "NO_WEBGPU" | "OUT_OF_MEMORY" | "GENERIC";

export function describeProviderError(err: unknown): { kind: ProviderErrorKind; detail: string } {
  const detail = err instanceof Error ? err.message : String(err);
  const d = detail.toLowerCase();
  if (d.includes("failed to fetch") || d.includes("networkerror") || d.includes("load failed")) {
    return { kind: "OLLAMA_UNREACHABLE", detail };
  }
  if (d.includes("not found") && d.includes("model")) return { kind: "MODEL_NOT_FOUND", detail };
  if (d.includes("webgpu") || d.includes("adapter")) return { kind: "NO_WEBGPU", detail };
  if (d.includes("out of memory") || d.includes("device lost") || d.includes("allocation")) {
    return { kind: "OUT_OF_MEMORY", detail };
  }
  return { kind: "GENERIC", detail };
}
