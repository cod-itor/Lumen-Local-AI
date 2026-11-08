import { api } from "@/lib/api";
import type { ProviderCatalogDto, ProviderDto } from "@/types/api";
import { ollamaProvider } from "./ollama";
import type { ClientModelProvider } from "./types";
import { pickBuild, webgpuSupport } from "./webgpu";

/** One browser-side provider per provider id, created lazily (FRONTEND.md §3.1). */
const instances = new Map<string, { key: string; provider: ClientModelProvider }>();
let catalog: Promise<ProviderCatalogDto> | null = null;

export function providerCatalog(): Promise<ProviderCatalogDto> {
  catalog ??= api.get<ProviderCatalogDto>("/api/providers/catalog").catch((e) => {
    catalog = null;
    throw e;
  });
  return catalog;
}

/** The WebLLM build this browser loads for a BROWSER provider (q4f16, or q4f32 without shader-f16). */
export async function browserBuild(model: string): Promise<string> {
  const [cat, gpu] = await Promise.all([providerCatalog(), webgpuSupport()]);
  if (!gpu.ok) throw new Error("WebGPU is not available in this browser.");
  const entry = cat.browser.models.find((m) => m.id === model || m.fallbackId === model);
  return entry ? pickBuild(entry, gpu.f16) : model;
}

export const providerRegistry = {
  async get(p: ProviderDto): Promise<ClientModelProvider> {
    const key = `${p.kind}|${p.baseUrl ?? ""}|${p.model}`;
    const hit = instances.get(p.id);
    if (hit && hit.key === key) return hit.provider;
    let provider: ClientModelProvider;
    if (p.kind === "LOCAL_OLLAMA") {
      provider = ollamaProvider(p.baseUrl ?? "http://localhost:11434", p.model);
    } else if (p.kind === "BROWSER") {
      const build = await browserBuild(p.model);
      const { webllmProvider } = await import("./webllm");
      provider = webllmProvider(build);
    } else {
      throw new Error(`${p.kind} models run on the server.`);
    }
    instances.set(p.id, { key, provider });
    return provider;
  },
  /** True when a BROWSER model still has to download/load before a turn. */
  async needsLoading(p: ProviderDto): Promise<boolean> {
    if (p.kind !== "BROWSER") return false;
    return !(await this.get(p)).isReady();
  },
};
