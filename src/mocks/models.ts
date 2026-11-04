import type { AppSection, ModelStatus } from "@/types";

/** Model shown in the top-left picker, per section. `null` = no picker (Documents). */
export const mockSectionModels: Record<AppSection, string | null> = {
  chat: "Gemma 4 E2B",
  learn: "Gemma 4 E2B",
  documents: null,
  image: "FLUX.2 klein",
};

/** Status card at the bottom of the sidebar, per section. */
export const mockModelStatus: Record<AppSection, ModelStatus> = {
  chat: {
    name: "Gemma 4 E2B",
    state: "ready",
    stateLabel: "Ready",
    detail: "EmbeddingGemma loaded · Queue 0",
  },
  learn: {
    name: "Gemma 4 E2B",
    state: "ready",
    stateLabel: "Ready",
    detail: "EmbeddingGemma loaded · Queue 0",
  },
  documents: {
    name: "Gemma 4 E2B",
    state: "ready",
    stateLabel: "Ready",
    detail: "EmbeddingGemma loaded · Queue 0",
  },
  image: {
    name: "FLUX.2 klein",
    state: "ready",
    stateLabel: "Ready",
    detail: "Loaded on demand · Queue 0",
  },
};
