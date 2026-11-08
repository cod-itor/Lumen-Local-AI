"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/provider";
import type { ApprovalDecision } from "@/lib/harness/useHarnessTurn";
import { riseItem } from "./assistant-answer";

/** "Ask before searching" (HARNESS.md §7.4): the user approves, edits or cancels the web search query. */
export function SearchApproval({
  query,
  onDecide,
  onCancel,
}: {
  query: string;
  onDecide: (d: ApprovalDecision) => void;
  onCancel: () => void;
}) {
  const m = useMessages().app.chat.live.approval;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = text.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 200;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const search = () => {
    if (!editing || trimmed === query) onDecide({ decision: "APPROVE" });
    else if (valid) onDecide({ decision: "EDIT", content: trimmed });
  };

  const btn =
    "rounded-full px-3.5 py-[7px] text-[12.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";

  return (
    <motion.div
      variants={riseItem}
      initial="hidden"
      animate="show"
      className="glass flex w-full max-w-[520px] flex-col gap-3 rounded-[20px] p-4"
      role="group"
      aria-label={m.title}
    >
      <div className="flex items-center gap-[7px] text-[13px] font-semibold text-foreground">
        <Icon name="globe" size={15} />
        {m.title}
      </div>
      <p className="text-[12.5px] leading-[18px] text-muted-foreground">
        {m.body}
      </p>
      {editing ? (
        <input
          ref={inputRef}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={m.edit}
          className="rounded-[12px] border border-border bg-transparent px-3 py-2 text-[14px] text-foreground outline-none focus:border-foreground/40"
        />
      ) : (
        <p className="rounded-[12px] bg-surface-muted px-3 py-2 text-[14px] break-words text-foreground">
          {query}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={search}
          disabled={editing && !valid}
          className={`${btn} bg-primary text-primary-foreground hover:opacity-90`}
        >
          {m.search}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${btn} border border-border text-foreground hover:bg-accent`}
          >
            {m.edit}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className={`${btn} text-muted-foreground hover:bg-accent hover:text-foreground`}
        >
          {m.cancel}
        </button>
      </div>
    </motion.div>
  );
}
