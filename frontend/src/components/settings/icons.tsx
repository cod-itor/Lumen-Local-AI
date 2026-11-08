import {
  FileSearch,
  Image as ImageIcon,
  Layers,
  MessageSquareText,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  chat: MessageSquareText,
  rag: FileSearch,
  image: ImageIcon,
  shield: ShieldCheck,
  tool: Wrench,
  sliders: SlidersHorizontal,
};

/** Settings icon by content key (see src/mocks/settings.ts). */
export function SettingsIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Layers;
  return <Cmp className={className} strokeWidth={1.8} />;
}
