import type { BrowserModelDto } from "@/types/api";

type GpuNavigator = Navigator & {
  gpu?: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> };
};

let cached: Promise<{ ok: boolean; f16: boolean; reason?: string }> | null = null;

/** WebGPU support and whether the GPU has `shader-f16` (FRONTEND.md §3.5). */
export function webgpuSupport(): Promise<{ ok: boolean; f16: boolean; reason?: string }> {
  cached ??= (async () => {
    const nav = navigator as GpuNavigator;
    if (!nav.gpu) return { ok: false, f16: false, reason: "NO_WEBGPU" };
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) return { ok: false, f16: false, reason: "NO_ADAPTER" };
      return { ok: true, f16: adapter.features.has("shader-f16") };
    } catch {
      return { ok: false, f16: false, reason: "NO_ADAPTER" };
    }
  })();
  return cached;
}

/** Every q4f16 build needs shader-f16: use the entry id when f16 is there, otherwise the q4f32 fallback. */
export const pickBuild = (m: BrowserModelDto, f16: boolean) => (f16 ? m.id : m.fallbackId);
