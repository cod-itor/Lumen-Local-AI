import type { ProviderModelInfo, ProviderTestCheck } from "@/types/api";

/** Failure codes of the connection test; the UI translates them, the server stores the English message. */
export type OllamaTestCode = "SAFARI" | "PERMISSION_DENIED" | "CORS" | "UNREACHABLE" | "NO_MODELS" | "MODEL_MISSING" | "NO_REPLY";

export type OllamaTestCheck = ProviderTestCheck & { code?: OllamaTestCode };

export interface OllamaTestResult {
  ok: boolean;
  checks: OllamaTestCheck[];
  models: string[];
  modelInfo?: ProviderModelInfo;
  failed?: OllamaTestCode;
}

const MESSAGES: Record<OllamaTestCode, string> = {
  SAFARI: "Safari can't connect to local apps. Use Chrome, Edge or Firefox.",
  PERMISSION_DENIED:
    "Your browser blocked access. Click the icon at the left of the address bar and allow access to apps on this device.",
  CORS: "Ollama isn't allowing this website yet. Do step 3 of the guide, then restart Ollama.",
  UNREACHABLE: "Can't reach Ollama. Make sure it is running (and allow access if your browser asks).",
  NO_MODELS: "No models yet. Run `ollama pull qwen3.5:2b`.",
  MODEL_MISSING: "That model isn't downloaded in your Ollama yet.",
  NO_REPLY: "The model didn't answer. Check the Ollama window for errors.",
};

const loopback = { targetAddressSpace: "loopback" } as RequestInit;

export function isSafari() {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Firefox|FxiOS|Edg/.test(ua);
}

/**
 * Connection test for "My Ollama" (FRONTEND.md §8.2). Checks run in order and stop at the first failure.
 * Without `model` it stops after listing the models (used before the visitor picks one).
 */
export async function testOllama(baseUrl: string, model?: string): Promise<OllamaTestResult> {
  const checks: OllamaTestCheck[] = [];
  const fail = (name: string, code: OllamaTestCode, models: string[] = []): OllamaTestResult => {
    checks.push({ name, ok: false, code, message: MESSAGES[code] });
    return { ok: false, checks, models, failed: code };
  };
  const pass = (name: string) => checks.push({ name, ok: true, message: null });

  if (isSafari()) return fail("browser", "SAFARI");
  pass("browser");

  try {
    const s = await navigator.permissions.query({ name: "loopback-network" } as unknown as PermissionDescriptor);
    if (s.state === "denied") return fail("permission", "PERMISSION_DENIED");
  } catch {
    // Permission name not supported by this browser: ignore.
  }
  pass("permission");

  try {
    const r = await fetch(`${baseUrl}/api/version`, loopback);
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    try {
      await fetch(`${baseUrl}/api/version`, { ...loopback, mode: "no-cors" });
      return fail("reach", "CORS");
    } catch {
      return fail("reach", "UNREACHABLE");
    }
  }
  pass("reach");

  let models: string[] = [];
  try {
    const tags = (await (await fetch(`${baseUrl}/api/tags`, loopback)).json()) as { models?: { name: string }[] };
    models = (tags.models ?? []).map((m) => m.name);
  } catch {
    return fail("models", "UNREACHABLE");
  }
  if (models.length === 0) return fail("models", "NO_MODELS");
  pass("models");
  if (!model) return { ok: true, checks, models };

  if (!models.includes(model) && !models.includes(`${model}:latest`)) return fail("modelInfo", "MODEL_MISSING", models);
  let modelInfo: ProviderModelInfo = { name: model };
  try {
    const show = (await (
      await fetch(`${baseUrl}/api/show`, {
        ...loopback,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      })
    ).json()) as {
      details?: { family?: string; parameter_size?: string; quantization_level?: string };
      model_info?: Record<string, unknown>;
    };
    const ctxKey = Object.keys(show.model_info ?? {}).find((k) => k.endsWith(".context_length"));
    const ctx = ctxKey ? Number(show.model_info![ctxKey]) : undefined;
    modelInfo = {
      name: model,
      family: show.details?.family,
      parameterSize: show.details?.parameter_size,
      quantization: show.details?.quantization_level,
      contextLength: ctx && Number.isFinite(ctx) ? ctx : undefined,
    };
  } catch {
    // Model info is optional.
  }
  pass("modelInfo");

  try {
    const r = await fetch(`${baseUrl}/api/chat`, {
      ...loopback,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: "Reply with the word OK." }],
        options: { num_predict: 5 },
      }),
    });
    const body = (await r.json()) as { message?: { content?: string } };
    if (!/ok/i.test(body.message?.content ?? "")) return { ...fail("generation", "NO_REPLY", models), modelInfo };
  } catch {
    return { ...fail("generation", "NO_REPLY", models), modelInfo };
  }
  pass("generation");
  return { ok: true, checks, models, modelInfo };
}
