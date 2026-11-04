"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fragment, useEffect, useState } from "react";

/** Animated "Thinking…" indicator: three bouncing dots + shimmering label. */
export function ThinkingIndicator() {
  return (
    <div role="status" aria-label="Thinking" className="flex items-center gap-2.5 text-[13px] text-subtle">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-current"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </span>
      <span className="shimmer-text">Thinking…</span>
    </div>
  );
}

/** Reveals text word by word, like a streamed model answer. */
export function StreamedText({ text, wordMs = 45 }: { text: string; wordMs?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const [shown, setShown] = useState(reduce ? words.length : 0);

  useEffect(() => {
    if (reduce || shown >= words.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), wordMs);
    return () => clearTimeout(t);
  }, [reduce, shown, words.length, wordMs]);

  return (
    <p className="text-[15px] leading-[24px] text-foreground">
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.slice(0, shown).map((w, i) => (
          // The space sits outside the inline-block, or it would collapse.
          <Fragment key={i}>
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {w}
            </motion.span>{" "}
          </Fragment>
        ))}
      </span>
    </p>
  );
}

/**
 * Placeholder answer for messages sent in the static prototype:
 * thinks for a moment, then streams a short note. Replace with the real
 * model stream when the API is connected.
 */
export function PreviewReply({
  text = "Answers will stream in here once the local model is connected. This is a preview of the conversation UI.",
  thinkMs = 1200,
}: {
  text?: string;
  thinkMs?: number;
}) {
  const [thinking, setThinking] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setThinking(false), thinkMs);
    return () => clearTimeout(t);
  }, [thinkMs]);

  return (
    <div className="min-h-6">
      <AnimatePresence mode="wait" initial={false}>
        {thinking ? (
          <motion.div key="thinking" exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
            <ThinkingIndicator />
          </motion.div>
        ) : (
          <motion.div key="answer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StreamedText text={text} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
