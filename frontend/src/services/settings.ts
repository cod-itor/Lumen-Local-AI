import "server-only";
import { mockAiSettings } from "@/mocks/settings";
import type { Localized } from "@/i18n/config";
import type { AiSettingsContent } from "@/types/settings";

/**
 * Today: example data. Later: read installed models from the local runtime
 * (Ollama `GET /api/tags`) and the user's role assignments from the backend.
 */
export async function getAiSettings(): Promise<Localized<AiSettingsContent>> {
  return mockAiSettings;
}
