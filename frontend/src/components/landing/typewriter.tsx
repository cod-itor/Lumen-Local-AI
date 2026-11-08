"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePageVisible } from "@/lib/performance";
import { cn } from "@/lib/utils";

/** Split into user-perceived characters so Khmer clusters never break mid-glyph. */
export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

function Caret({ className, blink = true }: { className?: string; blink?: boolean }) {
  return (
    <motion.span
      aria-hidden
      className={cn("ml-px inline-block w-[2px] translate-y-[0.12em] rounded-full bg-current", className)}
      style={{ height: "1em" }}
      animate={blink ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
      transition={blink ? { duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] } : undefined}
    />
  );
}

/**
 * Types phrases one after another: type → pause → delete → next.
 * Screen readers get the first phrase as static text.
 */
export function TypewriterLoop({
  phrases,
  typeMs = 55,
  deleteMs = 28,
  holdMs = 1600,
  startDelayMs = 900,
  className,
  caretClassName,
}: {
  phrases: string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  startDelayMs?: number;
  className?: string;
  caretClassName?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const onScreen = useInView(ref);
  const pageVisible = usePageVisible();
  const paused = !onScreen || !pageVisible;
  const split = useMemo(() => phrases.map(graphemes), [phrases]);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStarted(true), startDelayMs);
    return () => clearTimeout(t);
  }, [reduce, startDelayMs]);

  useEffect(() => {
    if (reduce || !started || paused || split.length === 0) return;
    const chars = split[index];
    let delay: number;
    let next: () => void;

    if (!deleting && count < chars.length) {
      // small jitter feels like a real person typing
      delay = typeMs + Math.random() * typeMs * 0.8;
      next = () => setCount((c) => c + 1);
    } else if (!deleting) {
      delay = holdMs;
      next = () => setDeleting(true);
    } else if (count > 0) {
      delay = deleteMs;
      next = () => setCount((c) => c - 1);
    } else {
      delay = 350;
      next = () => {
        setDeleting(false);
        setIndex((i) => (i + 1) % split.length);
      };
    }
    const t = setTimeout(next, delay);
    return () => clearTimeout(t);
  }, [reduce, started, paused, split, index, count, deleting, typeMs, deleteMs, holdMs]);

  const text = reduce ? phrases[0] : split[index]?.slice(0, count).join("") ?? "";

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{phrases[0]}</span>
      <span aria-hidden>
        {text}
        <Caret className={caretClassName} />
      </span>
    </span>
  );
}

/**
 * Types `text` once on mount. The full text is laid out invisibly underneath so
 * the typed copy never shifts the layout. The caret fades out when done.
 */
export function TypeOnce({
  text,
  delayMs = 250,
  charMs = 38,
  className,
  onDone,
}: {
  text: string;
  delayMs?: number;
  charMs?: number;
  className?: string;
  onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  const chars = useMemo(() => graphemes(text), [text]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setCount(i);
      if (i < chars.length) timer = setTimeout(tick, charMs);
      else onDone?.();
    };
    timer = setTimeout(tick, delayMs);
    return () => clearTimeout(timer);
  }, [reduce, chars, charMs, delayMs, onDone]);

  const done = reduce || count >= chars.length;
  const typing = count > 0;

  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      <span className="invisible" aria-hidden>
        {text}
      </span>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="absolute inset-0 whitespace-nowrap">
        {done ? text : chars.slice(0, count).join("")}
        <motion.span
          className="inline-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: done || !typing ? 0 : 1 }}
          transition={{ duration: 0.4, delay: done ? 0.8 : 0 }}
        >
          <Caret blink={!done} className="w-[3px]" />
        </motion.span>
      </span>
    </span>
  );
}
