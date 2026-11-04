import type { Metadata } from "next";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { getRoadmap } from "@/services/roadmap";

export const metadata: Metadata = {
  title: "Coming soon — Lumen",
  description: "Planned Lumen features, written down in full: architecture, changes, trade-offs and build order.",
};

export default async function ComingSoonPage() {
  // Both languages are sent; RoadmapView shows the one the user picked.
  return <RoadmapView bundle={await getRoadmap()} />;
}
