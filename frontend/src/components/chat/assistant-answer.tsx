"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useLocalized, useMessages, useTranslate } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { Localized } from "@/i18n/config";
import { format } from "@/i18n/messages";
import type { AnswerBlock, AssistantMessage, InlineSegment, Source } from "@/types/chat";
import { SourceFavicon } from "./source-favicon";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Child variant for the staggered fade + rise. */
export const riseItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

type CiteHandlers = {
  sourcesById: Record<string, Source>;
  activeSourceId: string | null;
  onCiteClick: (id: string) => void;
  onCiteHover: (id: string | null) => void;
};

/** Figma "Assistant Message": search trace, answer blocks, sources chip, actions. */
export function AssistantAnswer({
  message,
  sources,
  sourcesOpen,
  onToggleSources,
  ...cite
}: {
  message: AssistantMessage;
  sources: Source[];
  sourcesOpen: boolean;
  onToggleSources: () => void;
} & CiteHandlers) {
  const cited = message.sourceIds.map((id) => cite.sourcesById[id]).filter(Boolean);
  const t = useTranslate();

  return (
    <motion.div
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="flex w-full flex-col items-start gap-[14px]"
    >
      {message.searchTrace && <SearchTrace trace={message.searchTrace} />}

      {message.blocks.map((block, i) => (
        <motion.div key={i} variants={riseItem} className="w-full">
          <Block block={block} {...cite} />
        </motion.div>
      ))}

      {cited.length > 0 && (
        <motion.div variants={riseItem} className="flex items-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onToggleSources}
            aria-expanded={sourcesOpen}
            aria-label={t("app.chat.sourcesCount", { count: cited.length })}
            className={cn(
              "glass flex items-center gap-2 rounded-full py-[6px] pr-3 pl-2 transition-[border-color,background-color] duration-200 hover:bg-accent",
              sourcesOpen && "border-[1.5px]! border-orange-foreground!",
            )}
          >
            <span className="flex">
              {sources.slice(0, 3).map((s, i, arr) => (
                <SourceFavicon key={s.id} source={s} className={i < arr.length - 1 ? "-mr-[5px]" : ""} />
              ))}
            </span>
            <span className="text-[12.5px] font-medium whitespace-nowrap text-foreground">
              {t("app.chat.sourcesCount", { count: cited.length })}
            </span>
          </motion.button>
        </motion.div>
      )}

      <motion.div variants={riseItem}>
        <MessageActions text={plainText(message.blocks, cite.sourcesById)} />
      </motion.div>
    </motion.div>
  );
}

function SearchTrace({ trace }: { trace: Localized<string> }) {
  return (
    <motion.div variants={riseItem} className="flex items-center gap-[6px] text-subtle">
      <Icon name="globe" size={14} />
      <span className="text-[13px] whitespace-nowrap">{useLocalized(trace)}</span>
    </motion.div>
  );
}

/* --------------------------------------------------------------- blocks */

function Block({ block, ...cite }: { block: AnswerBlock } & CiteHandlers) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="text-[15.5px] leading-[26px] text-foreground">
          <Inline segments={block.content} {...cite} />
        </p>
      );
    case "list":
      return (
        <ul className="list-disc pl-[23px] text-[15.5px] leading-[26px] text-foreground marker:text-foreground">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline segments={item} {...cite} />
            </li>
          ))}
        </ul>
      );
    case "code":
      return <CodeBlock label={block.label} code={block.code} />;
  }
}

function Inline({ segments, ...cite }: { segments: InlineSegment[] } & CiteHandlers) {
  const t = useTranslate();
  return segments.map((seg, i) => {
    if (seg.type === "text") return <span key={i}>{seg.text}</span>;
    if (seg.type === "strong")
      return (
        <strong key={i} className="font-semibold">
          {seg.text}
        </strong>
      );
    const source = cite.sourcesById[seg.sourceId];
    if (!source) return null;
    const active = cite.activeSourceId === source.id;
    return (
      <button
        key={i}
        type="button"
        onClick={() => cite.onCiteClick(source.id)}
        onMouseEnter={() => cite.onCiteHover(source.id)}
        onMouseLeave={() => cite.onCiteHover(null)}
        onFocus={() => cite.onCiteHover(source.id)}
        onBlur={() => cite.onCiteHover(null)}
        aria-label={t("app.chat.sourceCite", { index: source.index, title: source.title })}
        className={cn(
          "inline rounded-[4px] align-baseline text-[12px] leading-none font-medium transition-colors duration-150",
          active ? "text-orange-foreground" : "text-subtle hover:text-orange-foreground",
        )}
      >
        {source.citeLabel}
      </button>
    );
  });
}

/** Figma "Code Block": label header with copy, mono body. */
function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, copy] = useCopy();
  const m = useMessages();
  return (
    <div className="w-full overflow-hidden rounded-[14px] border border-foreground/8 bg-foreground/7">
      <div className="flex items-center px-3 py-[7px]">
        <span className="text-[12px] whitespace-nowrap text-muted-foreground">{label}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => copy(code)}
          aria-label={copied ? m.common.copied : format(m.app.chat.copyLabel, { label })}
          className="-m-1 flex size-[22px] items-center justify-center rounded-[6px] text-icon transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon name={copied ? "chat-check" : "chat-copy14"} size={copied ? 10 : 14} />
        </button>
      </div>
      <div className="overflow-x-auto px-4 py-3 [scrollbar-width:thin]">
        <code className="block font-mono text-[13.5px] leading-[22px] whitespace-pre text-foreground">{code}</code>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- actions */

function MessageActions({ text }: { text: string }) {
  const [copied, copy] = useCopy();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const m = useMessages();
  const a = m.app.chat.actions;
  const btn =
    "flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent hover:text-foreground aria-pressed:text-foreground";

  return (
    <div className="flex items-center gap-[2px]">
      <button type="button" onClick={() => copy(text)} aria-label={copied ? m.common.copied : m.common.copy} className={btn}>
        <Icon name={copied ? "chat-check" : "chat-copy"} size={copied ? 12 : 15} />
      </button>
      <button
        type="button"
        aria-label={a.goodResponse}
        aria-pressed={vote === "up"}
        onClick={() => setVote((v) => (v === "up" ? null : "up"))}
        className={btn}
      >
        <Icon name="chat-tup" size={15} />
      </button>
      <button
        type="button"
        aria-label={a.badResponse}
        aria-pressed={vote === "down"}
        onClick={() => setVote((v) => (v === "down" ? null : "down"))}
        className={btn}
      >
        <Icon name="chat-tdown" size={15} />
      </button>
      <motion.button type="button" aria-label={a.regenerate} whileTap={{ rotate: -90 }} className={btn}>
        <Icon name="chat-refresh" size={15} />
      </motion.button>
      <button type="button" aria-label={a.translate} className={btn}>
        <Icon name="chat-lang" size={15} />
      </button>
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return [copied, copy] as const;
}

function plainText(blocks: AnswerBlock[], sourcesById: Record<string, Source>) {
  const inline = (segs: InlineSegment[]) =>
    segs
      .map((s) => (s.type === "cite" ? `[${sourcesById[s.sourceId]?.index ?? ""}]` : s.text))
      .join("");
  return blocks
    .map((b) =>
      b.type === "paragraph"
        ? inline(b.content)
        : b.type === "list"
          ? b.items.map((it) => `• ${inline(it)}`).join("\n")
          : b.code,
    )
    .join("\n\n");
}
