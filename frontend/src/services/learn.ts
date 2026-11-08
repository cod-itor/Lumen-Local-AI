import "server-only";
import { mockLearningPath } from "@/mocks/learn";
import type { LearningPath } from "@/types/learn";

// Swap each body for `apiFetch(...)` (see ./api.ts) when the backend is ready.

/** The learner's active path, with lessons, quizzes and saved progress. */
export async function getCurrentLearningPath(): Promise<LearningPath> {
  return mockLearningPath;
}
