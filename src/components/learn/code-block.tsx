"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { CodeSnippet, CodeTokenKind } from "@/types/learn";

/*
 * Syntax colors from Figma (identical in light and dark). There is no global
 * token for them yet; move these to `--syntax-*` tokens in globals.css when
 * the shell adds them.
 */
const TOKEN_CLASS: Record<CodeTokenKind, string> = {
  plain: "text-foreground",
  string: "text-syntax-string",
  keyword: "text-syntax-keyword",
  builtin: "text-syntax-builtin",
};

/** Figma "Code Block": language label + copy button, monospace highlighted code. */
export function CodeBlock({ code }: { code: CodeSnippet }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const text = code.lines.map((line) => line.map((t) => t.text).join("")).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex w-full flex-col rounded-[14px] border border-foreground/8 bg-foreground/5 dark:bg-foreground/7">
      <div className="flex items-center px-3 py-[7px]">
        <span className="text-[12px] leading-[normal] whitespace-nowrap text-muted-foreground">{code.language}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="-m-1 flex size-[22px] items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copied ? "done" : "copy"}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={cn("flex", copied && "text-success-foreground")}
            >
              <Icon name={copied ? "learn-check-md" : "learn-copy"} size={14} />
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13.5px] leading-[22px]">
        <code>
          {code.lines.map((line, i) => (
            <span key={i} className="block">
              {line.map((t, j) => (
                <span key={j} className={TOKEN_CLASS[t.kind ?? "plain"]}>
                  {t.text}
                </span>
              ))}
              {line.length === 0 && "\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
