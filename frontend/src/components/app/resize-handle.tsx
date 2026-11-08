"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readStored(key: string): number | null {
  try {
    const v = window.localStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // storage unavailable (private mode) — width just won't persist
  }
}

/**
 * Width state for a resizable pane, persisted per `storageKey` in localStorage.
 * `max` may be a function so it can depend on the viewport.
 */
export function useResizableWidth({
  storageKey,
  defaultWidth,
  min,
  max,
}: {
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number | (() => number);
}) {
  const maxOf = useCallback(() => (typeof max === "function" ? max() : max), [max]);
  const [width, setWidthState] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);

  // Restore the saved width after mount (localStorage isn't available during SSR).
  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored !== null) setWidthState(clamp(stored, min, maxOf())); // eslint-disable-line react-hooks/set-state-in-effect
  }, [storageKey, min, maxOf]);

  const setWidth = useCallback(
    (next: number) => {
      const w = clamp(next, min, maxOf());
      setWidthState(w);
      writeStored(storageKey, w);
    },
    [min, maxOf, storageKey],
  );

  const reset = useCallback(() => setWidth(defaultWidth), [setWidth, defaultWidth]);

  return { width, setWidth, reset, dragging, setDragging, min, maxOf };
}

/**
 * Vertical drag handle on a pane edge. `side` is the edge it sits on:
 * "right" for a left sidebar (drag right = wider), "left" for a right panel
 * (drag left = wider). Double-click resets; arrow keys nudge by 16px.
 */
export function ResizeHandle({
  side,
  label,
  width,
  setWidth,
  reset,
  setDragging,
  min,
  maxOf,
  className,
}: {
  side: "left" | "right";
  label: string;
  width: number;
  setWidth: (w: number) => void;
  reset: () => void;
  setDragging: (d: boolean) => void;
  min: number;
  maxOf: () => number;
  className?: string;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);
  const dir = side === "right" ? 1 : -1;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: width };
    setActive(true);
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setWidth(start.current.w + (e.clientX - start.current.x) * dir);
  };

  const end = () => {
    if (!start.current) return;
    start.current = null;
    setActive(false);
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={Math.round(maxOf())}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={reset}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setWidth(width - 16 * dir);
        else if (e.key === "ArrowRight") setWidth(width + 16 * dir);
        else if (e.key === "Enter") reset();
        else return;
        e.preventDefault();
      }}
      className={cn(
        "group absolute inset-y-6 z-10 flex w-3 cursor-col-resize touch-none items-center justify-center outline-none",
        side === "right" ? "-right-[14px]" : "-left-[14px]",
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="w-[3px] rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/25 group-focus-visible:bg-ring"
        animate={{ height: active ? 72 : 40, opacity: active ? 1 : undefined }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        style={active ? { backgroundColor: "var(--ring)" } : undefined}
      />
    </div>
  );
}
