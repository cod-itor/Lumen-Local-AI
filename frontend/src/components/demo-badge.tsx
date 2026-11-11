"use client";

import { RotateCcw } from "lucide-react";
import { useMessages } from "@/i18n/provider";

/** Shown only in the demo build: says the answers are samples and offers a reset of the browser-stored demo data. */
export function DemoBadge() {
  const m = useMessages().common.demo;
  if (process.env.NEXT_PUBLIC_LUMEN_DEMO !== "1") return null;

  const reset = async () => {
    if (!window.confirm(m.confirm)) return;
    (await import("@/lib/demo/server")).resetDemo();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  return (
    <div className="pointer-events-auto fixed right-3 bottom-3 z-[60] flex items-center gap-2 rounded-full border border-border bg-surface-raised/90 py-1 pr-1 pl-3 text-[12px] shadow-soft backdrop-blur">
      <span className="font-semibold text-foreground">{m.label}</span>
      <span className="hidden text-muted-foreground sm:inline">{m.hint}</span>
      <button
        type="button"
        onClick={() => void reset()}
        title={m.reset}
        aria-label={m.reset}
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  );
}
