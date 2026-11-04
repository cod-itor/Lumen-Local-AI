"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { EASE } from "./motion";

type Phase = "idle" | "editing" | "generating" | "cancelled";

const GENERATE_MS = 1600;
const TILE_COUNT = 4;

/** Figma "Approval Card": improved prompt the user must approve before generation. */
export function ApprovalCard({
  prompt: initialPrompt,
  resultHref,
}: {
  prompt: string;
  resultHref: string;
}) {
  const router = useRouter();
  const msgs = useMessages();
  const m = msgs.app.image.approval;
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState(initialPrompt);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const placeholdersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    router.prefetch(resultHref);
  }, [router, resultHref]);

  useEffect(() => {
    if (phase !== "generating") return;
    placeholdersRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const t = setTimeout(() => router.push(resultHref), GENERATE_MS);
    return () => clearTimeout(t);
  }, [phase, router, resultHref]);

  useEffect(() => {
    if (phase === "editing") editRef.current?.focus();
  }, [phase]);

  if (phase === "cancelled") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 text-[13px] text-muted-foreground"
      >
        {m.dismissed}
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="rounded-full px-2 py-1 font-medium text-foreground transition-colors hover:bg-accent"
        >
          {m.undo}
        </button>
      </motion.div>
    );
  }

  const generating = phase === "generating";

  return (
    <div className="flex w-full flex-col gap-[14px]">
      <motion.div
        layout
        transition={{ duration: 0.28, ease: EASE }}
        className="glass relative flex w-full flex-col gap-3 overflow-hidden rounded-[20px] p-4"
      >
        <div className="flex items-center gap-[7px]">
          <motion.span
            animate={generating ? { rotate: [0, 18, -12, 0], scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
            transition={generating ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
            className="flex"
          >
            <Icon name="img-sparkles" size={14} className="text-orange-foreground" />
          </motion.span>
          <span className="text-[13px] font-semibold text-foreground">{m.title}</span>
        </div>

        {phase === "editing" ? (
          <textarea
            ref={editRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                setPhase("idle");
              }
            }}
            aria-label={m.editPrompt}
            className="field-sizing-content w-full resize-none rounded-[12px] border border-border bg-transparent px-3 py-2 text-[14.5px] leading-[22px] text-foreground-tertiary outline-none focus:shadow-[0_0_0_3px_var(--brand-blue-soft)]"
          />
        ) : (
          <p className="text-[14.5px] leading-[22px] text-foreground-tertiary">{prompt}</p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {generating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="flex min-h-[37px] flex-wrap items-center gap-x-3 gap-y-1"
              role="status"
            >
              <span className="text-[13.5px] font-medium text-foreground">
                {format(m.generating, { count: TILE_COUNT })}
              </span>
              <div className="relative h-1 w-40 overflow-hidden rounded-full bg-accent">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: GENERATE_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-orange-strong"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="flex flex-wrap items-start gap-2"
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setPhase("generating")}
                disabled={!prompt.trim()}
                className="bg-primary-fill rounded-[12px] px-4 py-[9px] text-[13.5px] font-medium transition-[filter,opacity] hover:brightness-105 disabled:opacity-50"
              >
                {m.generate}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setPhase(phase === "editing" ? "idle" : "editing")}
                aria-pressed={phase === "editing"}
                className={cn(
                  "rounded-[12px] border border-border px-4 py-[9px] text-[13.5px] font-medium text-foreground transition-colors hover:bg-accent",
                  phase === "editing" && "bg-accent",
                )}
              >
                {phase === "editing" ? msgs.common.done : m.edit}
              </motion.button>
              <button
                type="button"
                onClick={() => {
                  setPrompt(initialPrompt);
                  setPhase("cancelled");
                }}
                className="rounded-full px-3 py-[9px] text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {msgs.common.cancel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {generating && (
          <motion.div
            key="placeholders"
            ref={placeholdersRef}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0 }}
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            className="grid w-full grid-cols-4 gap-[10px]"
            aria-hidden
          >
            {Array.from({ length: TILE_COUNT }, (_, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, scale: 0.96 },
                  show: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: EASE } },
                }}
                className="relative aspect-square overflow-hidden rounded-[16px] bg-surface-muted"
              >
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
                  className="absolute inset-0 bg-[linear-gradient(100deg,transparent_20%,var(--accent)_50%,transparent_80%)]"
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
