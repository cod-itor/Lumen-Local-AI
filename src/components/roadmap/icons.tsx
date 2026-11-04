import {
  AppWindow,
  Cpu,
  Database,
  Globe,
  Laptop,
  Layers,
  Package,
  Power,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/** Icon keys used by the roadmap content (src/mocks/roadmap.ts). */
export const ROADMAP_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  server: Server,
  laptop: Laptop,
  app: AppWindow,
  package: Package,
  cpu: Cpu,
  database: Database,
  power: Power,
  shield: ShieldCheck,
  layers: Layers,
};

/** Renders a roadmap icon by key (falls back to Layers). */
export function RoadmapIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ROADMAP_ICONS[name] ?? Layers;
  return <Cmp className={className} strokeWidth={1.8} />;
}

/** Accent per actor, from the brand tokens. */
export const ACTOR_TONE = {
  website: { text: "text-brand-blue-strong dark:text-brand-blue", bg: "bg-brand-blue", soft: "bg-brand-blue-soft" },
  backend: { text: "text-foreground", bg: "bg-foreground", soft: "bg-foreground/8" },
  desktop: { text: "text-brand-orange-strong dark:text-brand-orange", bg: "bg-brand-orange", soft: "bg-brand-orange-soft" },
} as const;
