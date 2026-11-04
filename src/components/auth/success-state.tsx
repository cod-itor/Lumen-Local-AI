"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { EASE } from "@/components/landing/motion";

/** Animated check: ring pops, tick draws itself, copy rises in. */
export function SuccessState({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div role="status" className="flex flex-col items-center gap-6 py-2 text-center">
      <div className="relative flex size-20 items-center justify-center">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-success/15"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.25, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full ring-2 ring-success/40"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
        />
        <motion.span
          className="relative flex size-14 items-center justify-center rounded-full bg-success text-background"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }}
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.35, ease: EASE }}
            />
          </svg>
        </motion.span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45, ease: EASE }}
        className="flex flex-col gap-2"
      >
        <h2 className="text-[26px] leading-[32px] font-semibold tracking-[-0.6px]">{title}</h2>
        <p className="mx-auto max-w-[320px] text-[15px] leading-[22px] text-balance text-muted-foreground">{description}</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55, ease: EASE }}
        className="w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Wrapper kept for call sites; the glass frame is <AuthFrame> in the layout. */
export function SuccessCard({ children }: { children: ReactNode }) {
  return <div className="py-4">{children}</div>;
}
