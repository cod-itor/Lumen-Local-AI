/**
 * "Coming soon" roadmap — planned features documented in the app so the
 * plan lives next to the product. Mocks in src/mocks/roadmap.ts.
 */

export type RoadmapStatus = "planned" | "in-progress" | "done";
export type Actor = "website" | "backend" | "desktop";

export type ArchNode = {
  id: Actor;
  title: string;
  subtitle: string;
  icon: string; // lucide icon key, see components/roadmap/icons.ts
  items: string[];
};

export type ArchLink = { from: Actor; to: Actor; label: string; detail: string };

export type JourneyStep = { actor: Actor; title: string; detail: string };

export type ChangeRow = { area: string; now: string; planned: string };

export type TechItem = { name: string; role: string; detail: string; icon: string };

export type TradeOff = { title: string; detail: string; icon: string };

export type Phase = { title: string; detail: string; status: RoadmapStatus };

export type TableColumn = { name: string; type: string; note: string };

export type ComingSoonFeature = {
  id: string;
  status: RoadmapStatus;
  badge: string;
  title: string;
  tagline: string;
  summary: string;
  facts: { label: string; value: string }[];
  architecture: { nodes: ArchNode[]; links: ArchLink[]; notes: string[] };
  howItWorks: { title: string; detail: string }[];
  journey: JourneyStep[];
  firstRun: string[];
  changes: ChangeRow[];
  tech: TechItem[];
  pairing: { title: string; detail: string }[];
  tradeOffs: TradeOff[];
  phases: Phase[];
  /** Planning notes added beyond the original idea — decide later. */
  extras: {
    devicesTable: TableColumn[];
    protocol: string;
    security: string[];
    openQuestions: string[];
  };
};

export type RoadmapContent = {
  title: string;
  intro: string;
  updated: string;
  features: ComingSoonFeature[];
};
