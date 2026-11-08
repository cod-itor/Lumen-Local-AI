"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { api } from "@/lib/api";
import { fileKind } from "@/lib/documents";
import type { ChunkDto, DocumentDto, DocumentTextDto } from "@/types/api";
import { FileBadge } from "./file-badge";

const EASE = [0.22, 1, 0.36, 1] as const;

/** A cited passage to show: the chunk (exact offsets) or, without one, the page. `nonce` re-triggers the scroll. */
export type ViewerFocus = { chunkId?: string; page?: number; nonce: number };

type Loaded = { page: number | null; text: string; total: number | null; hl: [number, number] | null };

/** Content of Figma "Right Panel · File viewer": header + the document's text with the cited passage highlighted. */
export function FileViewer({
  document: doc,
  focus,
  onClose,
}: {
  document: DocumentDto;
  focus: ViewerFocus | null;
  onClose: () => void;
}) {
  const msgs = useMessages().app.documents;
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const ready = doc.status === "READY";

  // Load the cited chunk (its page and offsets), else the requested page.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const run = async () => {
      let hl: [number, number] | null = null;
      let p = page;
      let chunkText: string | null = null;
      if (focus?.chunkId) {
        const c = await api.get<ChunkDto>(`/api/documents/${doc.id}/chunks/${focus.chunkId}`).catch(() => null);
        if (c) {
          p = c.page ?? 1;
          hl = [c.startChar, c.endChar];
          chunkText = c.text;
        }
      } else if (focus?.page) p = focus.page;
      const q = doc.pages ? `?page=${p}` : "";
      const t = await api.get<DocumentTextDto>(`/api/documents/${doc.id}/text${q}`);
      if (!alive) return;
      // Offsets are code points from the AI service; fall back to a text search if they don't line up.
      if (hl && chunkText && t.text.slice(hl[0], hl[1]) !== chunkText) {
        const i = t.text.indexOf(chunkText.slice(0, 80));
        hl = i >= 0 ? [i, i + chunkText.length] : null;
      }
      setPage(p);
      setData({ page: t.page, text: t.text, total: t.totalPages ?? doc.pages, hl });
      setFailed(false);
    };
    run().catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // `page` changes through goTo(); a focus change re-reads the cited chunk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, ready, focus?.nonce]);

  const goTo = async (p: number) => {
    const t = await api.get<DocumentTextDto>(`/api/documents/${doc.id}/text?page=${p}`).catch(() => null);
    if (!t) return;
    setPage(p);
    setData({ page: t.page, text: t.text, total: t.totalPages ?? doc.pages, hl: null });
  };

  const total = data?.total ?? doc.pages;
  const meta = doc.pages ? format(msgs.meta.pages, { pages: doc.pages }) : null;

  return (
    <>
      <header className="flex shrink-0 items-center gap-[10px] pt-[14px] pr-[14px] pl-4">
        <FileBadge kind={fileKind(doc)} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-[2px] whitespace-nowrap">
          <span className="truncate text-[15px] font-semibold text-foreground">{doc.filename}</span>
          {meta && <span className="truncate text-[11.5px] text-muted-foreground">{meta}</span>}
        </div>
        <div className="flex items-center gap-1 self-start pt-px">
          {total && total > 1 && data && (
            <>
              <ToolButton label={msgs.page.previous} disabled={page <= 1} onClick={() => void goTo(page - 1)}>
                <ChevronLeft size={16} />
              </ToolButton>
              <span
                aria-label={format(msgs.page.of, { page, total })}
                className="text-[12.5px] font-medium text-muted-foreground tabular-nums"
              >
                {page} / {total}
              </span>
              <ToolButton label={msgs.page.next} disabled={page >= total} onClick={() => void goTo(page + 1)}>
                <ChevronRight size={16} />
              </ToolButton>
            </>
          )}
          <a
            href={`/api/documents/${doc.id}/file`}
            download={doc.filename}
            aria-label={msgs.viewer.download}
            className="flex size-8 items-center justify-center rounded-2xl text-icon transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon name="doc-download" size={16} />
          </a>
          <ToolButton label={msgs.viewer.close} onClick={onClose}>
            <Icon name="doc-x" size={16} />
          </ToolButton>
        </div>
      </header>

      <div className="mx-[14px] mt-[22px] mb-4 min-h-0 flex-1 overflow-y-auto rounded-[18px] bg-foreground/[0.05] [scrollbar-width:thin]">
        {data && !failed ? (
          <motion.article
            key={`${doc.id}-${page}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.05 }}
            className="mx-auto my-[22px] w-[min(500px,calc(100%-32px))] bg-white px-11 py-10 text-[12.5px] leading-5 whitespace-pre-wrap text-foreground-tertiary shadow-soft dark:bg-white/10"
          >
            {data.hl ? (
              <>
                {data.text.slice(0, data.hl[0])}
                <Highlight text={data.text.slice(data.hl[0], data.hl[1])} nonce={focus?.nonce ?? 0} />
                {data.text.slice(data.hl[1])}
              </>
            ) : (
              data.text
            )}
          </motion.article>
        ) : (
          <p className="p-10 text-center text-[13px] text-muted-foreground">
            {!ready ? msgs.library.notReady : failed ? msgs.viewer.noPreview : null}
          </p>
        )}
      </div>
    </>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      className="flex size-8 items-center justify-center rounded-2xl text-icon transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

/** Figma "Highlighted Chunk": the cited passage. Scrolls into view + pulses when cited. */
function Highlight({ text, nonce }: { text: string; nonce: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // Wait a frame so a just-opened panel has laid out before scrolling.
    const raf = requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => cancelAnimationFrame(raf);
  }, [nonce]);
  return (
    <motion.span
      ref={ref}
      key={nonce}
      initial={{ backgroundColor: "rgb(247 174 104 / 0.55)" }}
      animate={{ backgroundColor: "rgb(247 174 104 / 0.22)" }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
      className="rounded-[3px] text-foreground [box-decoration-break:clone] shadow-[inset_3px_0_0_var(--color-brand-orange-strong)]"
    >
      {text}
    </motion.span>
  );
}
