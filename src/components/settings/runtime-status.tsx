"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiSettingsContent } from "@/types/settings";

/** Connection to the local model runtime. "Check again" is simulated for now. */
export function RuntimeStatus({ runtime }: { runtime: AiSettingsContent["runtime"] }) {
  const [checking, setChecking] = useState(false);
  const check = () => {
    setChecking(true);
    setTimeout(() => setChecking(false), 900);
  };
  return (
    <div className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
      <span className="relative flex size-2.5" aria-hidden>
        {runtime.connected && <span className="absolute inset-0 animate-ping rounded-full bg-success/50 [animation-duration:2.2s]" />}
        <span className={cn("relative size-2.5 rounded-full", runtime.connected ? "bg-success" : "bg-danger")} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-foreground">
          {runtime.connected ? `Connected to ${runtime.name}` : `${runtime.name} not found`}
        </span>
        <span className="text-[13px] text-muted-foreground">
          Running on this computer · {runtime.host} · v{runtime.version}
        </span>
      </div>
      <Button variant="outline" size="sm" className="rounded-full" onClick={check} disabled={checking}>
        <RefreshCw className={cn(checking && "animate-spin")} />
        {checking ? "Checking…" : "Check again"}
      </Button>
    </div>
  );
}
