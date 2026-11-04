"use client";

import { Composer } from "@/components/app/composer";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShellRightPanel } from "@/components/app/right-panel";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useLocale, useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type {
  Citation,
  DocumentMessage,
  DocumentThread,
  Material,
  MaterialPage,
} from "@/types/documents";
import { FileViewer, type HighlightFocus } from "./file-viewer";
import { SourcePicker } from "./source-picker";

const EASE = [0.22, 1, 0.36, 1] as const;
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

/** Figma "05 · Documents · Material open": thread + composer + file viewer panel. */
export function DocumentWorkspace({
  material,
  page,
  thread,
  materials,
}: {
  material: Material;
  page: MaterialPage | null;
  thread: DocumentThread | null;
  materials: Material[];
}) {
  const router = useRouter();
  const msgs = useMessages();
  const m = msgs.app.documents;
  const [viewerOpen, setViewerOpen] = useState(true);
  const [focus, setFocus] = useState<HighlightFocus | null>(null);
  // Sources for retrieval; seeded from the thread, persisted via services later.
  const [sources, setSources] = useState<string[]>(() => {
    const seeded = thread?.materialIds ?? [material.id];
    return seeded.includes(material.id) ? seeded : [material.id, ...seeded];
  });
  const picker = (variant: "pill" | "chip") => (
    <SourcePicker
      materials={materials}
      selected={sources}
      currentId={material.id}
      onChange={setSources}
      variant={variant}
    />
  );

  const openCitation = (c: Citation) => {
    if (c.materialId !== material.id) {
      router.push(`/documents/${c.materialId}`);
      return;
    }
    setViewerOpen(true);
    setFocus((f) => ({ highlightId: c.highlightId, nonce: (f?.nonce ?? 0) + 1 }));
  };

  return (
    <div className="flex h-full flex-col items-center px-[14px]">
      <div className="min-h-0 w-full flex-1 overflow-y-auto [scrollbar-width:none]">
        <motion.ol
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="mx-auto flex w-full max-w-(--chat-width) flex-col gap-7 pt-3 pb-6"
        >
          <motion.li variants={item} className="flex justify-center">
            {picker("pill")}
          </motion.li>

          {thread ? (
            thread.messages.map((msg) => (
              <motion.li key={msg.id} variants={item}>
                <Message message={msg} onCite={openCitation} />
              </motion.li>
            ))
          ) : (
            <motion.li variants={item} className="flex flex-col items-center gap-2 pt-24 text-center">
              <span className="text-[20px] font-semibold tracking-[-0.5px] text-foreground">
                {format(m.askAbout, { name: material.name })}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {m.askHint}
              </span>
            </motion.li>
          )}
        </motion.ol>
      </div>

      <div className="w-full max-w-[calc(var(--chat-width)+20px)] pt-3">
        <Composer
          placeholder={m.placeholder}
          showSearch={false}
          attachIcon="doc-clip"
          attachLabel={m.attach}
          leading={picker("chip")}
        />
      </div>
      <p className="mt-[6px] -mb-[5px] text-center text-[11.5px] leading-[14px] text-subtle">
        {msgs.common.aiDisclaimer}
      </p>

      <ShellRightPanel
        open={viewerOpen}
        width={540}
        label={m.viewer.panel}
        panelId="File viewer"
        className="overflow-hidden"
        onClose={() => setViewerOpen(false)}
      >
        <FileViewer
          material={material}
          page={page}
          focus={focus}
          onClose={() => setViewerOpen(false)}
        />
      </ShellRightPanel>
    </div>
  );
}

function Message({ message: m, onCite }: { message: DocumentMessage; onCite: (c: Citation) => void }) {
  const locale = useLocale();
  const pageShort = useMessages().app.documents.pageShort;
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-[22px] bg-surface-muted px-[18px] py-[11px] text-[15px] leading-[22px] text-foreground">
          {m.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-[14px]">
      <p className="text-[15.5px] leading-[26px] text-foreground">
        {m.content.map((s, i) =>
          s.bold ? (
            <strong key={i} className="font-semibold">
              {s.text}
            </strong>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>

      {m.citations && m.citations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {m.citations.map((c) => (
            <motion.button
              key={c.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => onCite(c)}
              className="flex items-center gap-[6px] rounded-full border-[1.5px] border-brand-orange-line px-3 py-[6px] text-foreground transition-colors hover:bg-brand-orange-soft"
            >
              <Icon name="doc-file-sm" size={13} />
              <span className="text-[12px] font-medium whitespace-nowrap">
                {c.fileName} · {format(pageShort, { page: c.page })}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {m.showActions && <MessageActions text={m.content.map((s) => s.text).join("")} />}

      {m.followUps && (
        <div className="flex flex-wrap gap-2">
          {m.followUps.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flex items-center gap-[6px] rounded-full border border-border px-3 py-[7px] text-foreground transition-colors hover:bg-accent"
            >
              {f.icon && <Icon name="doc-upload" size={14} />}
              <span className="text-[12.5px] font-medium whitespace-nowrap">{f.label[locale]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageActions({ text }: { text: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const msgs = useMessages();
  const chat = msgs.app.chat.actions;
  const doc = msgs.app.documents.actions;
  const actions = [
    { id: "copy", icon: "doc-copy", label: msgs.common.copy, onClick: () => void navigator.clipboard?.writeText(text) },
    { id: "up", icon: "doc-tup", label: doc.goodAnswer, onClick: () => setRating((r) => (r === "up" ? null : "up")) },
    { id: "down", icon: "doc-tdown", label: doc.badAnswer, onClick: () => setRating((r) => (r === "down" ? null : "down")) },
    { id: "refresh", icon: "doc-refresh", label: chat.regenerate },
    { id: "lang", icon: "doc-lang", label: chat.translate },
  ];
  return (
    <div className="flex items-center gap-[2px]">
      {actions.map((a) => (
        <motion.button
          key={a.id}
          type="button"
          aria-label={a.label}
          aria-pressed={a.id === "up" || a.id === "down" ? rating === a.id : undefined}
          whileTap={{ scale: 0.9 }}
          onClick={a.onClick}
          className={cn(
            "flex size-[30px] items-center justify-center rounded-[15px] transition-colors hover:bg-accent hover:text-foreground",
            rating === a.id ? "text-foreground" : "text-icon",
          )}
        >
          <Icon name={a.icon} size={15} />
        </motion.button>
      ))}
    </div>
  );
}
