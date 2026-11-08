"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { toMaterial, useDocuments } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { FileBadge, useMaterialMeta } from "./file-badge";

const MAX_MB = 25;

/** /documents: upload dropzone + the library (FRONTEND.md §7.4). */
export function DocumentsHome() {
  const m = useMessages().app.documents.library;
  const docs = useDocuments();
  const meta = useMaterialMeta();
  const [over, setOver] = useState(false);

  const remove = async (id: string, name: string) => {
    if (!window.confirm(format(m.removeConfirm, { name }))) return;
    await docs.remove(id).catch(() => undefined);
  };

  return (
    <div className="h-full overflow-y-auto [scrollbar-width:none]">
      <div className="mx-auto flex w-[min(var(--chat-width),calc(100%-32px))] flex-col gap-6 pt-10 pb-10">
        <div className="flex flex-col gap-1.5 text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.5px] text-foreground">{m.title}</h1>
          <p className="text-[13.5px] leading-5 text-muted-foreground">{m.hint}</p>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={docs.pick}
          disabled={!!docs.uploading}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void docs.uploadAndOpen(f);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-border px-6 py-10 transition-colors hover:bg-accent/50",
            over && "border-brand-orange-line bg-brand-orange-soft",
          )}
        >
          <Icon name="doc-upload" size={22} className="text-icon" />
          <span className="text-[14px] font-medium text-foreground">
            {docs.uploading ? format(m.uploading, { name: docs.uploading }) : over ? m.drop : m.upload}
          </span>
          <span className="text-[12px] text-muted-foreground">{format(m.limits, { mb: MAX_MB })}</span>
        </motion.button>
        {docs.notice && (
          <p role="status" className="-mt-3 text-center text-[12.5px] text-orange-foreground">
            {docs.notice}
          </p>
        )}

        {docs.loaded && docs.documents.length === 0 && (
          <p className="text-center text-[13px] text-muted-foreground">{m.empty}</p>
        )}
        <ul className="flex flex-col gap-1">
          {docs.documents.map((d) => {
            const mat = toMaterial(d, docs.progress[d.id]);
            const open = mat.status === "embedding";
            return (
              <li key={d.id} className="group flex items-center gap-3 rounded-[14px] px-3 py-2 transition-colors hover:bg-accent/60">
                <Link href={`/documents/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <FileBadge kind={mat.kind} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-medium text-foreground">{d.filename}</span>
                    <span
                      className={cn(
                        "truncate text-[11.5px]",
                        open ? "text-orange-foreground" : mat.status === "failed" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {meta(mat)}
                    </span>
                  </span>
                </Link>
                {open && docs.progress[d.id] !== undefined && (
                  <button
                    type="button"
                    onClick={() => void docs.cancel(d.id)}
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {m.cancel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(d.id, d.filename)}
                  className="rounded-full px-2.5 py-1 text-[12px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-destructive focus-visible:opacity-100"
                >
                  {m.remove}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
