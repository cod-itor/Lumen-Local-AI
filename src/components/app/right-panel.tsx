"use client";

import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

/**
 * Full-height glass panel on the right of the app window (Figma:
 * "Right Panel · Sources", "Right Panel · File viewer", "Right Panel · Selected image").
 * Render it from a page; it portals into the shell so the header/tab bar
 * re-centers over the remaining space, and it slides open/closed.
 */
export function ShellRightPanel({
  open,
  width,
  className,
  children,
  label,
}: {
  open: boolean;
  /** Figma width in px: 320 (sources), 620 (file viewer), 300 (selected image). */
  width: number;
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  const { rightPanelHost } = useShell();
  if (!rightPanelHost) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="right-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: width + 12, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-full shrink-0 justify-end overflow-hidden"
        >
          <motion.aside
            aria-label={label}
            initial={{ x: 24 }}
            animate={{ x: 0 }}
            exit={{ x: 24 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ width }}
            className={cn("glass flex h-full flex-col rounded-[28px]", className)}
          >
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    rightPanelHost,
  );
}
