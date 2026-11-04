"use client";

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Counts a stat up when it scrolls into view. Keeps any prefix/suffix
 * ("~2B" → "~" + 2 + "B", "16 GB" → 16 + " GB"). A target of 0 counts down
 * from 100, which reads as "nothing leaves your machine".
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const match = value.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
    if (!el || !match || !inView || reduce) return;
    const [, prefix, num, suffix] = match;
    const target = Number(num);
    const from = target === 0 ? 100 : 0;
    const decimals = num.includes(".") ? num.split(".")[1].length : 0;
    const controls = animate(from, target, {
      duration: target === 0 ? 1.4 : 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {value}
    </span>
  );
}

/**
 * Card wrapper with a soft light that follows the cursor inside it.
 * Updates two CSS variables on pointer move (no React re-render).
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn("group/spot relative h-full", className)}
    >
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--glow-blue) 80%, transparent), transparent 70%)",
        }}
      />
    </div>
  );
}

/** Thin gradient line that draws from left to right when scrolled into view. */
export function DrawLine({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className={cn(
        "pointer-events-none block h-px origin-left bg-linear-to-r from-brand-blue-strong via-brand-orange to-transparent",
        className,
      )}
      initial={{ scaleX: reduce ? 1 : 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
    />
  );
}
