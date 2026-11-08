import { applyProfile } from "./messages";
import type { ClientModelProvider, GenerateDone } from "./types";

type OllamaChunk = {
  error?: string;
  message?: { content?: string };
  done?: boolean;
  done_reason?: string;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
};

/** The visitor's own Ollama on localhost (FRONTEND.md §3.3). */
export function ollamaProvider(baseUrl: string, model: string): ClientModelProvider {
  return {
    kind: "LOCAL_OLLAMA",
    model,
    async ensureReady() {
      // Ollama loads the model on the first request.
    },
    isReady: () => true,
    async *generate({ messages, params, schema, profile, signal }) {
      const started = performance.now();
      const body: Record<string, unknown> = {
        model,
        stream: true,
        keep_alive: "10m",
        messages: applyProfile(messages, profile),
        options: {
          temperature: params.temperature,
          top_p: params.topP,
          min_p: params.minP ?? undefined,
          num_predict: params.maxTokens,
          num_ctx: params.numCtx,
          repeat_penalty: params.repeatPenalty,
          stop: params.stop,
          seed: params.seed ?? undefined,
        },
      };
      if (schema && profile.jsonSchema) body.format = schema;
      if (profile.disableThinking === "OLLAMA_THINK_FALSE") body.think = false;

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
        // Chrome Local Network Access: declare the loopback target (ignored elsewhere).
        targetAddressSpace: "loopback",
      } as RequestInit);
      if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let ttft: number | null = null;
      let last: OllamaChunk | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const obj = JSON.parse(line) as OllamaChunk;
          if (obj.error) throw new Error(obj.error);
          const text = obj.message?.content ?? "";
          if (text) {
            ttft ??= performance.now() - started;
            yield { text };
          }
          if (obj.done) last = obj;
        }
      }
      const evalSec = last?.eval_duration ? last.eval_duration / 1e9 : null;
      const out: GenerateDone = {
        finishReason: last?.done_reason === "length" ? "LENGTH" : "STOP",
        stats: {
          model,
          ttftMs: ttft === null ? null : Math.round(ttft),
          outputTokens: last?.eval_count ?? null,
          promptTokens: last?.prompt_eval_count ?? null,
          tokensPerSec: evalSec && last?.eval_count ? +(last.eval_count / evalSec).toFixed(1) : null,
          totalMs: Math.round(performance.now() - started),
        },
      };
      return out;
    },
  };
}
