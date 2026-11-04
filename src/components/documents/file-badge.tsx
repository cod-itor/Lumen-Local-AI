import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { FileKind } from "@/types/documents";

const TONE: Record<FileKind, string> = {
  pdf: "bg-danger/14 text-danger",
  docx: "bg-info/14 text-info",
  md: "bg-muted-foreground/14 text-muted-foreground",
  txt: "bg-subtle/14 text-subtle",
};

/** Figma "File Badge": tinted square with the file extension. */
export function FileBadge({ kind, size = "sm" }: { kind: FileKind; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-bold uppercase",
        size === "sm" ? "size-[30px] rounded-[8px] text-[8.5px]" : "size-[34px] rounded-[9px] text-[9.5px]",
        TONE[kind],
      )}
    >
      {kind}
    </span>
  );
}

/** Sidebar / picker status line ("18 pages · Ready", "Embedding… 64%"). */
export function useMaterialMeta() {
  const meta = useMessages().app.documents.meta;
  return (m: { pages?: number; status: string; progress?: number }) => {
    if (m.status === "embedding") return format(meta.embedding, { progress: m.progress ?? 0 });
    return m.pages ? format(meta.pagesReady, { pages: m.pages }) : meta.ready;
  };
}
