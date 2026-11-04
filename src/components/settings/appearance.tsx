"use client";

import { Moon, MoveHorizontal, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { ChatWidthDialog } from "@/components/app/chat-width-dialog";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import { useChatWidth } from "@/lib/chat-width";
import { cn } from "@/lib/utils";

/** Theme + chat width, with the same live width dialog as the app. */
export function AppearanceSettings() {
  const { resolvedTheme, setTheme } = useTheme();
  const width = useChatWidth();
  const [open, setOpen] = useState(false);
  const t = useMessages().settings.appearance;
  const themes = [
    { id: "dark", label: t.dark, icon: Moon },
    { id: "light", label: t.light, icon: Sun },
  ] as const;

  return (
    <div className="glass flex flex-col divide-y divide-border rounded-3xl">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-foreground">{t.theme}</span>
          <span className="text-[13.5px] text-muted-foreground">{t.themeHint}</span>
        </div>
        <div role="radiogroup" aria-label={t.theme} className="flex gap-1 rounded-full bg-foreground/5 p-1">
          {themes.map((t) => {
            const on = resolvedTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold text-foreground">{t.chatWidth}</span>
          <span className="text-[13.5px] text-muted-foreground">
            {t.chatWidthHint} · <span className="tabular-nums">{width}px</span>
          </span>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
          <MoveHorizontal /> {t.adjust}
        </Button>
      </div>
      <ChatWidthDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
