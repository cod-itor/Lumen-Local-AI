import "server-only";
import type { Localized } from "@/i18n/config";
import { mockLanding } from "@/mocks/landing";
import type { LandingContent } from "@/types/landing";

// Swap for `apiFetch(...)` (see ./api.ts) when landing copy comes from a CMS/backend.
/** Landing copy in every language; the client picks the active one. */
export async function getLandingContent(): Promise<Localized<LandingContent>> {
  return mockLanding;
}
