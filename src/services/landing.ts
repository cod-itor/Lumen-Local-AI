import "server-only";
import { mockLanding } from "@/mocks/landing";
import type { LandingContent } from "@/types/landing";

// Swap for `apiFetch(...)` (see ./api.ts) when landing copy comes from a CMS/backend.
export async function getLandingContent(): Promise<LandingContent> {
  return mockLanding;
}
