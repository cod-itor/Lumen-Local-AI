import { LearnStep } from "@/components/learn/learn-step";
import { getCurrentLearningPath } from "@/services/learn";

/** Figma "08 · Learn · Step + quiz" */
export default async function LearnPage() {
  const path = await getCurrentLearningPath();
  return <LearnStep path={path} />;
}
