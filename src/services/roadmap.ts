import "server-only";
import { mockRoadmap } from "@/mocks/roadmap";
import type { RoadmapContent } from "@/types/roadmap";

// Swap for `apiFetch(...)` (./api.ts) if the roadmap ever comes from the backend/CMS.
export async function getRoadmap(): Promise<RoadmapContent> {
  return mockRoadmap;
}
