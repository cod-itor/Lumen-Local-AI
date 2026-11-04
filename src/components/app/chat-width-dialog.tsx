"use client";

import { motion } from "motion/react";
import { MoveHorizontal, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { CHAT_WIDTH, setChatWidth, useChatWidth } from "@/lib/chat-width";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Narrow", value: 640 },
  { label: "Default", value: CHAT_WIDTH.default },
  { label: "Wide", value: 960 },
  { label: "Full", value: CHAT_WIDTH.max },
];

/**
 * Settings → Chat width. Docked at the bottom with a light, unblurred
 * backdrop so the conversation behind stays visible and resizes live while
 * the slider is dragged (mouse or swipe). Cancel restores the old width.
 */
export function ChatWidthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const width = useChatWidth();
  // Remember the width at the moment the dialog opens, for Cancel.
  const [wasOpen, setWasOpen] = useState(open);
  const [before, setBefore] = useState(width);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBefore(width);
  }
  const cancel = () => {
    setChatWidth(before);
    onOpenChange(false);
  };
  const pct = ((width - CHAT_WIDTH.min) / (CHAT_WIDTH.max - CHAT_WIDTH.min)) * 100;

  return (
    // Escape / outside click keep the current width (it's already saved).
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/15 supports-backdrop-filter:backdrop-blur-none"
        className="glass top-auto bottom-6 max-w-[calc(100%-1.5rem)] translate-y-0 gap-5 rounded-3xl bg-popover/85 p-5 ring-0 sm:max-w-[460px] sm:p-6"
      >
        <DialogHeader className="gap-1.5">
          <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold">
            <MoveHorizontal className="size-4" strokeWidth={1.8} />
            Chat width
          </DialogTitle>
          <DialogDescription className="text-[13.5px]">
            Drag or swipe to resize the conversation. It updates live behind this panel.
          </DialogDescription>
        </DialogHeader>

        {/* Mini preview: a column inside a frame, scaled to the chosen width. */}
        <div aria-hidden className="relative flex h-14 items-center justify-center rounded-2xl bg-foreground/5 px-3">
          <motion.div
            className="flex h-8 flex-col justify-center gap-1.5 rounded-lg border border-border bg-background/60 px-3"
            animate={{ width: `${18 + pct * 0.8}%` }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          >
            <span className="h-1 w-3/4 rounded-full bg-foreground/25" />
            <span className="h-1 w-1/2 rounded-full bg-foreground/15" />
          </motion.div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted-foreground">Width</span>
            <span className="text-[15px] font-semibold tabular-nums" aria-live="polite">
              {width}px
            </span>
          </div>
          <Slider
            aria-label="Chat width"
            min={CHAT_WIDTH.min}
            max={CHAT_WIDTH.max}
            step={CHAT_WIDTH.step}
            value={width}
            // Live: update the CSS variable on every move, persist on release.
            onValueChange={(v) => setChatWidth(Array.isArray(v) ? v[0] : v, false)}
            onValueCommitted={(v) => setChatWidth(Array.isArray(v) ? v[0] : v)}
            className="py-2 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-1.5"
          />
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={width === p.value}
                onClick={() => setChatWidth(p.value)}
                className={cn(
                  "h-8 rounded-full text-[12.5px]",
                  width === p.value && "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90",
                )}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 flex-row justify-between rounded-none border-0 bg-transparent p-0 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setChatWidth(CHAT_WIDTH.default)}>
            <RotateCcw /> Reset
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="bg-primary-fill rounded-full px-4" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
