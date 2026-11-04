"use client";

import { ArrowLeft, ArrowLeftRight, ArrowUp, ArrowUpDown } from "lucide-react";
import { motion } from "motion/react";
import { EASE } from "@/components/landing/motion";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { Actor, ArchLink, ArchNode } from "@/types/roadmap";
import { ACTOR_TONE, RoadmapIcon } from "./icons";

/**
 * System diagram: Website ⇄ Backend ⇠ Desktop app. Horizontal on desktop,
 * stacked on phones. Packets travel along each connector (CSS transforms
 * only) to show which way data flows — note the desktop dials *out*.
 */
export function ArchitectureDiagram({
  nodes,
  links,
  notes,
  active,
}: {
  nodes: ArchNode[];
  links: ArchLink[];
  notes: string[];
  /** Highlight one actor (driven by the message journey). */
  active?: Actor | null;
}) {
  const m = useMessages();
  const node = (id: Actor) => nodes.find((n) => n.id === id)!;
  const link = (from: Actor) => links.find((l) => l.from === from)!;

  return (
    <figure aria-label={m.roadmap.diagram.label} className="flex flex-col gap-5">
      <div className="grid items-stretch gap-0 lg:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_150px_minmax(0,1fr)]">
        <NodeCard node={node("website")} active={active} index={0} />
        <Connector link={link("website")} direction="both" />
        <NodeCard node={node("backend")} active={active} index={1} />
        <Connector link={link("desktop")} direction="left" />
        <NodeCard node={node("desktop")} active={active} index={2} />
      </div>
      <figcaption className="flex flex-wrap justify-center gap-2">
        {notes.map((n) => (
          <span
            key={n}
            className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-foreground"
          >
            <span className="size-1.5 rounded-full bg-success" />
            {n}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function NodeCard({ node, active, index }: { node: ArchNode; active?: Actor | null; index: number }) {
  const tone = ACTOR_TONE[node.id];
  const on = active === node.id;
  const dim = active && !on;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: EASE, delay: index * 0.1 }}
      className={cn(
        "glass relative flex flex-col gap-4 rounded-3xl p-5 transition-opacity duration-300 sm:p-6",
        dim && "opacity-55",
      )}
    >
      {/* Active ring (opacity-only transition) */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-px rounded-[inherit] ring-2 transition-opacity duration-300",
          node.id === "website" ? "ring-brand-blue" : node.id === "desktop" ? "ring-brand-orange" : "ring-foreground/40",
          on ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="flex items-center gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", tone.soft, tone.text)}>
          <RoadmapIcon name={node.icon} className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold text-foreground">{node.title}</div>
          <div className="text-[12.5px] text-muted-foreground">{node.subtitle}</div>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {node.items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[13.5px] leading-[19px] text-foreground-secondary [:lang(km)_&]:leading-[23px]">
            <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", tone.bg)} />
            {it}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Connector({ link, direction }: { link: ArchLink; direction: "both" | "left" }) {
  return (
    <div className="relative flex min-h-[92px] items-center justify-center lg:min-h-0 lg:flex-col">
      {/* Track: vertical on phones, horizontal on desktop */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 overflow-hidden bg-[repeating-linear-gradient(180deg,color-mix(in_srgb,var(--foreground)_28%,transparent)_0_6px,transparent_6px_11px)] lg:top-1/2 lg:right-0 lg:bottom-auto lg:left-0 lg:h-px lg:w-auto lg:translate-x-0 lg:bg-[repeating-linear-gradient(90deg,color-mix(in_srgb,var(--foreground)_28%,transparent)_0_6px,transparent_6px_11px)]"
      >
        {/* Forward packet (towards the backend). On the desktop link it flows right → left. */}
        <span
          className={cn(
            "animate-travel-y absolute inset-0 lg:animate-travel-x",
            direction === "left" && "[animation-direction:reverse]",
          )}
        >
          <span
            className={cn(
              "absolute top-0 left-1/2 size-2 -translate-x-1/2 rounded-full shadow-[0_0_10px_currentColor] lg:top-1/2 lg:left-0 lg:-translate-y-1/2 lg:translate-x-0",
              direction === "left" ? "bg-brand-orange text-brand-orange" : "bg-brand-blue text-brand-blue",
            )}
          />
        </span>
        {/* Reply packet coming back */}
        <span
          className={cn(
            "animate-travel-y absolute inset-0 [animation-delay:1.2s] lg:animate-travel-x",
            direction === "both" && "[animation-direction:reverse]",
          )}
        >
          <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-success shadow-[0_0_8px_var(--color-success)] lg:top-1/2 lg:left-0 lg:-translate-y-1/2 lg:translate-x-0" />
        </span>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-0.5 rounded-xl bg-background/80 px-2.5 py-1.5 text-center">
        <span className="flex max-w-[140px] items-center justify-center gap-1 text-[11.5px] font-semibold text-foreground">
          {/* Up/down while stacked on phones, left/right side by side on desktop */}
          {direction === "both" ? (
            <>
              <ArrowUpDown className="size-3 lg:hidden" strokeWidth={2.2} />
              <ArrowLeftRight className="hidden size-3 lg:block" strokeWidth={2.2} />
            </>
          ) : (
            <>
              <ArrowUp className="size-3 lg:hidden" strokeWidth={2.2} />
              <ArrowLeft className="hidden size-3 lg:block" strokeWidth={2.2} />
            </>
          )}
          <span className="min-w-0">{link.label}</span>
        </span>
        <span className="max-w-[140px] text-[10.5px] leading-[14px] text-muted-foreground [:lang(km)_&]:leading-[18px]">{link.detail}</span>
      </div>
    </div>
  );
}
