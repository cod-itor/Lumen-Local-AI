"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { EASE } from "@/components/landing/motion";

/** Cross-fades between the form card and its success card. */
export function StepSwap({ stepKey, children }: { stepKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
