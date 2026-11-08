"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import type { Material, MaterialPage, PageBlock } from "@/types/documents";
import { FileBadge } from "./file-badge";

const EASE = [0.22, 1, 0.36, 1] as const;

export type HighlightFocus = { highlightId: string; nonce: number };

/** Content of Figma "Right Panel · File viewer": header + rendered page canvas. */
export function FileViewer({
  material,
  page,
  focus,
  onClose,
}: {
  material: Material;
  page: MaterialPage | null;
  focus: HighlightFocus | null;
  onClose: () => void;
}) {
  const msgs = useMessages().app.documents;
  const meta = [
    material.pages ? format(msgs.meta.pages, { pages: material.pages }) : null,
    material.sharedBy ? format(msgs.meta.sharedBy, { name: material.sharedBy }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <header className="flex shrink-0 items-center gap-[10px] pt-[14px] pr-[14px] pl-4">
        <FileBadge kind={material.kind} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-[2px] whitespace-nowrap">
          <span className="truncate text-[15px] font-semibold text-foreground">{material.name}</span>
          {meta && <span className="truncate text-[11.5px] text-muted-foreground">{meta}</span>}
        </div>
        <div className="flex items-center gap-1 self-start pt-px">
          {page && material.pages && (
            <span className="pr-2 text-[12.5px] font-medium text-muted-foreground tabular-nums">
              {page.page} / {material.pages}
            </span>
          )}
          <ToolButton label={msgs.viewer.download} icon="doc-download" />
          <ToolButton label={msgs.viewer.close} icon="doc-x" onClick={onClose} />
        </div>
      </header>

      <div className="mx-[14px] mt-[22px] mb-4 min-h-0 flex-1 overflow-y-auto rounded-[18px] bg-foreground/[0.05] [scrollbar-width:thin]">
        {page ? (
          <motion.article
            key={page.materialId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.05 }}
            className="mx-auto my-[22px] flex w-[min(500px,calc(100%-32px))] flex-col gap-3 bg-white px-11 py-10 shadow-soft dark:bg-white/10"
          >
            {page.blocks.map((b, i) => (
              <Block key={i} block={b} focus={focus} />
            ))}
          </motion.article>
        ) : (
          <p className="p-10 text-center text-[13px] text-muted-foreground">{msgs.viewer.noPreview}</p>
        )}
      </div>
    </>
  );
}

function ToolButton({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className="flex size-8 items-center justify-center rounded-2xl text-icon transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon name={icon} size={16} />
    </motion.button>
  );
}

function Block({ block, focus }: { block: PageBlock; focus: HighlightFocus | null }) {
  switch (block.type) {
    case "eyebrow":
      return (
        <p className="text-[9.5px] leading-[14px] font-semibold tracking-[1.14px] text-subtle">
          {block.text}
        </p>
      );
    case "title":
      return (
        <h2 className="text-[22px] leading-[28px] font-semibold whitespace-pre-wrap text-foreground">
          {block.text}
        </h2>
      );
    case "heading":
      return (
        <h3 className="text-[15px] leading-[22px] font-semibold whitespace-pre-wrap text-foreground">
          {block.text}
        </h3>
      );
    case "paragraph":
      return <p className="text-[12.5px] leading-5 text-foreground-tertiary">{block.text}</p>;
    case "highlight":
      return (
        <HighlightedChunk
          id={block.id}
          text={block.text}
          nonce={focus?.highlightId === block.id ? focus.nonce : null}
        />
      );
  }
}

/** Figma "Highlighted Chunk": the cited passage. Scrolls into view + pulses when cited. */
function HighlightedChunk({ id, text, nonce }: { id: string; text: string; nonce: number | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (nonce === null) return;
    // Wait a frame so a just-opened panel has laid out before scrolling.
    const raf = requestAnimationFrame(() =>
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    return () => cancelAnimationFrame(raf);
  }, [nonce]);

  return (
    <div
      ref={ref}
      id={`hl-${id}`}
      className="relative rounded-[8px] border-l-3 border-brand-orange-strong bg-brand-orange/20 px-3 py-[10px]"
    >
      {nonce !== null && (
        <motion.span
          key={nonce}
          aria-hidden
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 1, 0], scale: [1, 1.015, 1] }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          className="pointer-events-none absolute -inset-[3px] rounded-[10px] bg-brand-orange/15 ring-2 ring-brand-orange"
        />
      )}
      <p className="relative text-[12.5px] leading-5 text-foreground">{text}</p>
    </div>
  );
}
