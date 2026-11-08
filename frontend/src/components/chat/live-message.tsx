"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/icon";
import { useMessages, useTranslate } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { MessageDto, SourceDto, SuggestionDto } from "@/types/api";
import { riseItem, useCopy } from "./assistant-answer";
import { Markdown, type Unsupported } from "./markdown";

const btn =
  "flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/** A saved assistant message (MessageDto): Markdown, status, suggestions, speed, actions, versions. */
export function LiveAssistantMessage({
  message,
  version,
  onVersion,
  onRegenerate,
  busy,
  showSpeed,
  onCite,
}: {
  /** Opens a cited source (Documents: the file viewer at the passage). */
  onCite?: (source: SourceDto) => void;
  message: MessageDto;
  version: { index: number; count: number };
  onVersion: (delta: -1 | 1) => void;
  onRegenerate: () => void;
  busy: boolean;
  showSpeed: boolean;
}) {
  const m = useMessages();
  const t = useTranslate();
  const live = m.app.chat.live;
  const [copied, copy] = useCopy();
  const { meta, status } = message;
  const support = meta.guard?.action === "SUPPORT";
  const stats = meta.stats;
  const docSources = meta.sources.filter((s) => s.kind === "DOC");
  const cite = onCite && docSources.length ? (n: number) => {
    const src = meta.sources.find((s) => s.n === n);
    if (src) onCite(src);
  } : undefined;
  const level = meta.grounding?.level;
  const unsupported: Unsupported[] =
    meta.pipeline === "RAG" && meta.grounding
      ? meta.grounding.sentences
          .filter((s) => !s.supported && s.end > s.start)
          .map((s) => ({
            text: matchable(message.content.slice(s.start, s.end)),
            title: live.issues[s.issue ?? "LOW_SUPPORT"],
          }))
          .filter((u) => u.text.length >= 12)
      : [];

  return (
    <motion.div variants={riseItem} initial="hidden" animate="show" className="flex w-full flex-col items-start gap-[12px]">
      {status === "ABSTAINED" && <Badge icon="globe">{live.abstained}</Badge>}
      <div
        className={cn(
          "w-full",
          (status === "BLOCKED" || support) && "rounded-[18px] border border-border bg-surface-muted/60 px-4 py-3",
        )}
      >
        <Markdown text={message.content} onCite={cite} unsupported={unsupported} />
      </div>

      {docSources.length > 0 && onCite && (
        <div className="flex flex-wrap gap-2">
          {docSources.map((src) => (
            <motion.button
              key={src.n}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onCite(src)}
              title={src.snippet}
              className="flex max-w-full items-center gap-[6px] rounded-full border-[1.5px] border-brand-orange-line px-3 py-[6px] text-foreground transition-colors hover:bg-brand-orange-soft"
            >
              <span className="text-[11px] font-semibold text-muted-foreground">{src.n}</span>
              <Icon name="doc-file-sm" size={13} />
              <span className="truncate text-[12px] font-medium whitespace-nowrap">
                {src.title}
                {src.page != null && ` · ${t("app.documents.pageShort", { page: src.page })}`}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {meta.pipeline === "RAG" && (level === "GROUNDED" || level === "PARTIAL" || level === "UNGROUNDED") && (
        <span
          className={cn(
            "flex items-center gap-[6px] text-[12px] font-medium",
            level === "GROUNDED" ? "text-subtle" : "text-orange-foreground",
          )}
        >
          <span
            className={cn(
              "size-[7px] rounded-full",
              level === "GROUNDED" ? "bg-emerald-500" : level === "PARTIAL" ? "bg-brand-orange" : "bg-destructive",
            )}
          />
          {live.grounding[level]}
        </span>
      )}

      {status === "STOPPED" && <Badge>{live.stopped}</Badge>}
      {meta.grounding?.hasSpecificFacts && meta.pipeline === "CHAT" && (
        <p className="text-[12px] text-subtle">{live.specificFacts}</p>
      )}

      {meta.suggestions.length > 0 && <Suggestions items={meta.suggestions} />}

      <div className="flex items-center gap-[2px]">
        {version.count > 1 && (
          <div className="mr-1 flex items-center text-[12px] text-muted-foreground tabular-nums">
            <button type="button" className={btn} disabled={busy || version.index === 0} onClick={() => onVersion(-1)} aria-label="Previous version">
              <ChevronLeft size={15} />
            </button>
            <span>
              {version.index + 1} / {version.count}
            </span>
            <button
              type="button"
              className={btn}
              disabled={busy || version.index === version.count - 1}
              onClick={() => onVersion(1)}
              aria-label="Next version"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
        <button type="button" onClick={() => copy(message.content)} aria-label={copied ? m.common.copied : m.common.copy} className={btn}>
          <Icon name={copied ? "chat-check" : "chat-copy"} size={copied ? 12 : 15} />
        </button>
        {!support && status !== "BLOCKED" && (
          <motion.button
            type="button"
            aria-label={m.app.chat.actions.regenerate}
            whileTap={{ rotate: -90 }}
            className={btn}
            disabled={busy}
            onClick={onRegenerate}
          >
            <Icon name="chat-refresh" size={15} />
          </motion.button>
        )}
        {showSpeed && stats?.tokensPerSec != null && meta.model && (
          <span className="ml-2 text-[11.5px] text-placeholder tabular-nums">
            {t("app.chat.live.speed", { model: meta.model, tps: Math.round(stats.tokensPerSec) })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/** The longest leading run of a sentence that stays inside one Markdown text node (no markup, no citations). */
function matchable(sentence: string) {
  const body = sentence
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "\u0000")
    .trim();
  const cut = body.search(/[\u0000*_`[\]#>|~]/);
  return (cut < 0 ? body : body.slice(0, cut)).trim();
}

function Badge({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <span className="flex items-center gap-[6px] text-[12.5px] font-medium text-subtle">
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

const SUGGESTION_HREF: Partial<Record<SuggestionDto["type"], (s: SuggestionDto) => string>> = {
  OPEN_IMAGE_TAB: () => "/image",
  START_LEARNING_PATH: () => "/learn",
  ASK_MY_DOCUMENTS: () => "/documents",
  UPLOAD_DOCUMENT: () => "/documents",
};

function Suggestions({ items }: { items: SuggestionDto[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => {
        const href = SUGGESTION_HREF[s.type]?.(s);
        const cls =
          "rounded-full border border-border px-3 py-[6px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent";
        return href ? (
          <Link key={s.type} href={href} className={cls}>
            {s.label}
          </Link>
        ) : (
          <span key={s.type} className={cn(cls, "cursor-default hover:bg-transparent")}>
            {s.label}
          </span>
        );
      })}
    </div>
  );
}

/** The answer while it streams: stage line, then the growing Markdown with a caret. */
export function StreamingReply({ text, stageLabel }: { text: string; stageLabel: string | null }) {
  return (
    <div className="flex w-full flex-col items-start gap-[10px]" aria-live="polite">
      {(!text || stageLabel) && (
        <span className="flex items-center gap-2 text-[13px] text-subtle">
          <span className="size-[7px] animate-pulse rounded-full bg-foreground/50" />
          {stageLabel}
        </span>
      )}
      {text && (
        <div className="w-full [&>div>*:last-child]:after:ml-[2px] [&>div>*:last-child]:after:inline-block [&>div>*:last-child]:after:h-[1em] [&>div>*:last-child]:after:w-[2px] [&>div>*:last-child]:after:animate-pulse [&>div>*:last-child]:after:bg-foreground/60 [&>div>*:last-child]:after:align-[-2px] [&>div>*:last-child]:after:content-['']">
          <Markdown text={text} />
        </div>
      )}
    </div>
  );
}
