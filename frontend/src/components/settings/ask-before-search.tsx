"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/provider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SettingsDto } from "@/types/api";

/** "Ask before searching" (SettingsDto.askBeforeSearch): web searches wait for the user's OK first. */
export function AskBeforeSearch() {
  const m = useMessages().settings.privacy;
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<SettingsDto>("/api/settings")
      .then((s) => alive && setOn(s.askBeforeSearch))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async () => {
    if (on === null || saving) return;
    const next = !on;
    setOn(next);
    setSaving(true);
    try {
      const s = await api.patch<SettingsDto>("/api/settings", { askBeforeSearch: next });
      setOn(s.askBeforeSearch);
    } catch {
      setOn(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-4 sm:px-5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-medium text-foreground">{m.askBeforeSearch}</span>
        <span className="text-[13px] text-muted-foreground">{m.askBeforeSearchDetail}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on ?? false}
        aria-label={m.askBeforeSearch}
        disabled={on === null}
        onClick={() => void toggle()}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40",
          on ? "bg-primary" : "bg-foreground/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform",
            on && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
