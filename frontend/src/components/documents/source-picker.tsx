"use client";

import { AnimatePresence, motion } from "motion/react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { Material } from "@/types/documents";
import { FileBadge, useMaterialMeta } from "./file-badge";

/**
 * Pick which materials the answer is grounded in (multi-file RAG). The open
 * file is the default; add more and Lumen retrieves passages across all of
 * them, citing each one. At least one file always stays selected.
 */
export function SourcePicker({
  materials,
  selected,
  currentId,
  onChange,
  variant = "pill",
}: {
  materials: Material[];
  selected: string[];
  currentId: string;
  onChange: (ids: string[]) => void;
  variant?: "pill" | "chip";
}) {
  const t = useMessages().app.documents.picker;
  const materialMeta = useMaterialMeta();
  const ready = materials.filter((m) => m.status === "ready");
  const picked = materials.filter((m) => selected.includes(m.id));

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((s) => s !== id);
    if (next.length > 0) onChange(materials.filter((m) => next.includes(m.id)).map((m) => m.id));
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={format(t.trigger, { count: picked.length, total: materials.length })}
        className={cn(
          "group flex items-center gap-[6px] rounded-full border border-border text-foreground transition-colors hover:bg-accent data-[popup-open]:bg-accent",
          variant === "pill" ? "px-3 py-[6px]" : "h-[34px] px-2.5",
        )}
      >
        {variant === "pill" ? (
          <Icon name="doc-book-sm" size={14} />
        ) : (
          <Layers className="size-[15px]" strokeWidth={1.8} aria-hidden />
        )}
        <span className="text-[12px] font-medium whitespace-nowrap">
          {withCount(
            variant === "pill" ? t.using : picked.length === 1 ? t.chipOne : t.chipMany,
            <NumberSwap value={picked.length} />,
            { total: materials.length },
          )}
        </span>
        <Icon
          name="doc-chev-sm"
          size={13}
          className="text-muted-foreground transition-transform duration-200 group-data-[popup-open]:rotate-180"
        />
      </PopoverTrigger>

      <PopoverContent
        side={variant === "pill" ? "bottom" : "top"}
        sideOffset={8}
        className="w-[min(340px,calc(100vw-24px))] gap-1 rounded-2xl p-1.5"
      >
        <PopoverHeader className="px-2.5 pt-2 pb-1.5">
          <PopoverTitle className="flex items-center gap-2 text-[14px]">
            <Layers className="size-4" strokeWidth={1.8} />
            {t.title}
          </PopoverTitle>
          <PopoverDescription className="text-[12.5px] leading-[18px]">
            {t.description}
          </PopoverDescription>
        </PopoverHeader>

        <ul className="flex max-h-[300px] flex-col overflow-y-auto [scrollbar-width:thin]">
          {materials.map((m) => {
            const on = selected.includes(m.id);
            const disabled = m.status !== "ready" || (on && selected.length === 1);
            const id = `source-${m.id}`;
            return (
              <li key={m.id}>
                <label
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent",
                    m.status !== "ready" && "cursor-not-allowed opacity-60 hover:bg-transparent",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={on}
                    disabled={disabled}
                    onCheckedChange={(checked) => toggle(m.id, checked)}
                  />
                  <FileBadge kind={m.kind} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium text-foreground">{m.name}</span>
                    <span className="text-[11.5px] text-muted-foreground">{materialMeta(m)}</span>
                  </span>
                  {m.id === currentId && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-muted-foreground">
                      {t.openBadge}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-border px-1 pt-1.5">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onChange([currentId])}>
            {t.onlyThis}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            disabled={ready.every((m) => selected.includes(m.id))}
            onClick={() => onChange(ready.map((m) => m.id))}
          >
            {t.selectAllReady}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Fills a "{count} …" template, putting `count` (a node) where `{count}` sits. */
function withCount(template: string, count: React.ReactNode, vars: Record<string, number>) {
  const [before, after = ""] = format(template, vars).split("{count}");
  return (
    <>
      {before}
      {count}
      {after}
    </>
  );
}

/** Count that rolls when it changes. */
function NumberSwap({ value }: { value: number }) {
  return (
    <span className="relative inline-flex overflow-hidden align-bottom tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
