"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { Source } from "@/types/chat";
import { riseItem } from "./assistant-answer";

/** Body of Figma "Right Panel · Sources (open)". Rendered inside <ShellRightPanel>. */
export function SourcesPanel({
  sources,
  searchSteps,
  searchQuery,
  activeSourceId,
  onHoverSource,
  onClose,
}: {
  sources: Source[];
  searchSteps: string[];
  searchQuery: string;
  activeSourceId: string | null;
  onHoverSource: (id: string | null) => void;
  onClose: () => void;
}) {
  const m = useMessages().app.chat.sources;
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } } }}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-[18px] [scrollbar-width:none]"
    >
      {/* Panel Header */}
      <div className="flex w-full shrink-0 items-center gap-2">
        <h2 className="text-[16px] font-semibold tracking-[-0.08px] whitespace-nowrap text-foreground">
          {m.title}
        </h2>
        <span className="bg-primary-fill rounded-full px-[7px] py-[2px] text-[11px] font-medium">
          {sources.length}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label={m.close}
          className="-mr-1 flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon name="chat-x" size={16} />
        </button>
      </div>

      {/* Search Steps */}
      <motion.div
        variants={riseItem}
        className="glass flex w-full shrink-0 flex-col gap-[10px] rounded-[18px] px-[14px] pt-3 pb-[14px]"
      >
        <span className="text-[11px] font-medium tracking-[0.66px] whitespace-nowrap text-placeholder">
          {m.searchSteps}
        </span>
        <ul className="flex flex-col gap-[10px]">
          {searchSteps.map((step) => (
            <li key={step} className="flex items-center gap-[10px]">
              <span className="bg-primary-fill flex size-[18px] shrink-0 items-center justify-center rounded-[9px]">
                <Icon name="chat-check" size={10} />
              </span>
              <span className="text-[13px] text-foreground-secondary">{step}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Privacy note */}
      <motion.div variants={riseItem} className="flex w-full shrink-0 items-start gap-2 px-1">
        <Icon name="chat-lock" size={14} className="mt-px text-muted-foreground" />
        <p className="min-w-0 flex-1 text-[11.5px] leading-4 text-muted-foreground">
          {format(m.privacy, { query: searchQuery })}
        </p>
      </motion.div>

      {/* Card/Source list */}
      {sources.map((s) => (
        <motion.div key={s.id} variants={riseItem} className="w-full shrink-0">
          <SourceCard
            source={s}
            active={activeSourceId === s.id}
            onHover={(on) => onHoverSource(on ? s.id : null)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Figma "Card/Source": number + letter favicon + domain, title, one-line snippet. */
function SourceCard({
  source,
  active,
  onHover,
}: {
  source: Source;
  active: boolean;
  onHover: (on: boolean) => void;
}) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={cn(
        "glass flex w-full flex-col gap-[6px] rounded-[18px] p-[14px] transition-[border-color,transform,background-color] duration-200 hover:-translate-y-px hover:bg-accent",
        active && "border-[1.5px]! border-orange-foreground!",
      )}
    >
      <span className="flex items-center gap-[7px] overflow-hidden">
        <span className="bg-primary-fill flex size-[18px] shrink-0 items-center justify-center rounded-[9px] text-[10px] font-bold">
          {source.index}
        </span>
        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-foreground/15 text-[10px] font-bold text-foreground">
          {source.letter}
        </span>
        <span className="truncate text-[11.5px] text-muted-foreground">{source.domain}</span>
      </span>
      <span className="truncate text-[13.5px] leading-[18px] font-semibold text-foreground">
        {source.title}
      </span>
      <span className="truncate text-[12px] leading-4 text-muted-foreground">{source.snippet}</span>
    </a>
  );
}
