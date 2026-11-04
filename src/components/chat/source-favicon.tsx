import { cn } from "@/lib/utils";
import type { Source, SourceTone } from "@/types/chat";

const TONE: Record<SourceTone, string> = {
  neutral: "bg-muted-foreground",
  teal: "bg-teal",
  yellow: "bg-yellow",
  blue: "bg-info",
  orange: "bg-brand-orange-strong",
};

/** Round tinted favicon used in the stacked "N sources" chip. */
export function SourceFavicon({ source, className }: { source: Source; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[10px] border-2 border-border-glass text-[9px] font-bold text-white",
        TONE[source.tone],
        className,
      )}
    >
      {source.letter}
    </span>
  );
}
