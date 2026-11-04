"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Each auth step rises in; the layout around it stays put. */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
