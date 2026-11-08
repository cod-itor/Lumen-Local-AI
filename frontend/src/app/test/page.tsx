import type { Metadata } from "next";
import { ModelTest } from "@/components/evals/model-test";

export const metadata: Metadata = {
  title: "Model Test — Lumen",
  description: "Score how well a model works inside Lumen: safety, documents, honesty, tools, instructions, JSON and Khmer.",
};

export default function TestPage() {
  return <ModelTest />;
}
