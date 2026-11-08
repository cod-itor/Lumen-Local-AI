"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Each auth step fades in place inside the fixed card — no movement. */
export default function AuthTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
