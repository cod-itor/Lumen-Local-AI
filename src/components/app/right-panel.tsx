"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ResizeHandle, useResizableWidth } from "./resize-handle";
import { useShell } from "./shell-context";

/** Panels may take up to ~55% of the window (never more than 900px). */
const panelMax = () =>
  typeof window === "undefined" ? 900 : Math.min(900, Math.round(window.innerWidth * 0.55));

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Glass panel on the right of the app (Figma: "Right Panel · Sources",
 * "Right Panel · File viewer", "Right Panel · Selected image").
 *
 * Desktop: docked beside the content, under the header, slides open/closed.
 * Mobile/tablet: bottom sheet over the content with a backdrop. On mobile a panel
 * that is open on first render starts closed (calls `onClose`), so pages open to
 * their main content; user actions open it as a sheet.
 */
export function ShellRightPanel({
  open,
  width,
  className,
  children,
  label,
  onClose,
}: {
  open: boolean;
  /** Default width in px (user can drag the left edge to resize; it's remembered). */
  width: number;
  className?: string;
  children: React.ReactNode;
  label: string;
  /** Closes the panel (backdrop click / Escape / mobile first render). */
  onClose?: () => void;
}) {
  const { rightPanelHost, isDesktop } = useShell();
  const closedInitialMobile = useRef(false);
  const rs = useResizableWidth({
    storageKey: `lumen:panel-width:${label}`,
    defaultWidth: width,
    min: 280,
    max: panelMax,
  });

  useEffect(() => {
    if (!isDesktop && open && onClose && !closedInitialMobile.current) {
      closedInitialMobile.current = true;
      onClose();
    }
    // only on first mobile render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!isDesktop) {
    if (typeof document === "undefined") return null;
    return createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="sheet-backdrop"
              aria-hidden
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.aside
              key="sheet"
              aria-label={label}
              role="dialog"
              aria-modal="true"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: EASE }}
              className={cn(
                "glass fixed inset-x-2 bottom-2 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-[28px] bg-background/85",
                className,
              )}
            >
              {children}
            </motion.aside>
          </>
        )}
      </AnimatePresence>,
      document.body,
    );
  }

  if (!rightPanelHost) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="right-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: rs.width + 12, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={rs.dragging ? { duration: 0 } : { duration: 0.32, ease: EASE }}
          className="relative flex h-full shrink-0 justify-end overflow-hidden"
        >
          <ResizeHandle side="left" label={`Resize ${label.toLowerCase()}`} className="left-0" {...rs} />
          <motion.aside
            aria-label={label}
            initial={{ x: 24 }}
            animate={{ x: 0 }}
            exit={{ x: 24 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ width: rs.width }}
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
