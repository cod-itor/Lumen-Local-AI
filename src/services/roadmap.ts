import "server-only";
import type { Localized } from "@/i18n/config";
import { mockRoadmap } from "@/mocks/roadmap";
import type { RoadmapContent } from "@/types/roadmap";

// Every language at once; the client picks the current one with useLocalized().
// Swap for `apiFetch(...)` (./api.ts) if the roadmap ever comes from the backend/CMS.
export async function getRoadmap(): Promise<Localized<RoadmapContent>> {
  return mockRoadmap;
}
