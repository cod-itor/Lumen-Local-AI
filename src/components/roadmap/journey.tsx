"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePageVisible } from "@/lib/performance";
import { cn } from "@/lib/utils";
import type { ArchLink, ArchNode, JourneyStep } from "@/types/roadmap";
import { ArchitectureDiagram } from "./architecture-diagram";
import { ACTOR_TONE } from "./icons";

const STEP_MS = 2600;
const ACTOR_LABEL = { website: "Website", backend: "Backend", desktop: "Desktop app" } as const;

/**
 * Diagram + "how a message travels" walkthrough. Steps auto-play while on
 * screen (paused when off screen, tab hidden or reduced motion) and light up
 * the actor doing the work. Click a step to jump to it.
 */
export function ArchitectureWithJourney({
  nodes,
  links,
  notes,
  steps,
}: {
  nodes: ArchNode[];
  links: ArchLink[];
  notes: string[];
  steps: JourneyStep[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const visible = usePageVisible();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const running = playing && inView && visible && !reduce;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % steps.length), STEP_MS);
    return () => clearTimeout(t);
  }, [running, index, steps.length]);

  const step = steps[index];

  return (
    <div ref={ref} className="flex flex-col gap-10">
      <ArchitectureDiagram nodes={nodes} links={links} notes={notes} active={step.actor} />

      <div className="glass flex flex-col gap-5 rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-semibold text-foreground">How one message travels</h3>
            <p className="text-[13.5px] text-muted-foreground">From your phone to your laptop and back, in six steps.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            aria-pressed={playing}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Play"}
          </Button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.span
                className={cn("block h-full origin-left rounded-full", ACTOR_TONE[s.actor].bg)}
                initial={false}
                animate={{ scaleX: i < index ? 1 : i === index ? 1 : 0, opacity: i <= index ? 1 : 0 }}
                transition={{ duration: i === index && running ? STEP_MS / 1000 : 0.3, ease: "linear" }}
              />
            </span>
          ))}
        </div>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => {
            const on = i === index;
            const tone = ACTOR_TONE[s.actor];
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-current={on ? "step" : undefined}
                  onClick={() => {
                    setIndex(i);
                    setPlaying(false);
                  }}
                  className={cn(
                    "relative flex h-full w-full items-start gap-3 rounded-2xl p-3.5 text-left transition-colors",
                    on ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                      on ? cn(tone.bg, "text-background") : "bg-foreground/8 text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn("text-[11px] font-semibold tracking-wide uppercase", tone.text)}>
                      {ACTOR_LABEL[s.actor]}
                    </span>
                    <span className="text-[14px] font-semibold text-foreground">{s.title}</span>
                    <span className="text-[13px] leading-[18px] text-muted-foreground">{s.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="sr-only" aria-live="polite">{`Step ${index + 1}: ${step.title}. ${step.detail}`}</p>
      </div>
    </div>
  );
}
