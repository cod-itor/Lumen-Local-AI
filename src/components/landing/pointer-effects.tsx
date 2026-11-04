"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** True only on devices with a real mouse/trackpad (no touch-only screens). */
function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}

/**
 * Soft brand glow that follows the cursor across the page. It is a single
 * blurred circle moved with transform, so it never repaints the page.
 */
export function CursorSpotlight() {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 140, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 140, damping: 22, mass: 0.6 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!fine || reduce) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
    };
    const leave = () => setVisible(false);
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [fine, reduce, x, y]);

  if (!fine || reduce) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-0 size-[520px] rounded-full will-change-transform"
      style={{
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
        backgroundImage:
          "radial-gradient(closest-side, var(--glow-blue), color-mix(in oklab, var(--glow-orange) 60%, transparent) 55%, transparent 100%)",
      }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
    />
  );
}

/**
 * Tilts its children toward the cursor (max `max` degrees) with a spring.
 * Reacts while the pointer is over or just above the element.
 */
export function TiltOnPointer({
  children,
  max = 4,
  className,
}: {
  children: ReactNode;
  max?: number;
  className?: string;
}) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max * 0.75, -max * 0.75]), {
    stiffness: 120,
    damping: 18,
  });

  useEffect(() => {
    if (!fine || reduce) return;
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // only react while the pointer is near the element
      if (e.clientY < r.top - 300 || e.clientY > r.bottom + 100) {
        px.set(0);
        py.set(0);
        return;
      }
      px.set(Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5)));
      py.set(Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5)));
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [fine, reduce, px, py]);

  return (
    <div className={cn("[perspective:1600px]", className)}>
      <motion.div
        ref={ref}
        style={fine && !reduce ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Pulls its child slightly toward the cursor while hovered ("magnetic" button). */
export function Magnetic({
  children,
  strength = 0.25,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx: MotionValue<number> = useSpring(x, { stiffness: 260, damping: 18 });
  const sy: MotionValue<number> = useSpring(y, { stiffness: 260, damping: 18 });
  const active = fine && !reduce;

  return (
    <motion.div
      className={cn("inline-flex", className)}
      style={active ? { x: sx, y: sy } : undefined}
      onPointerMove={(e) => {
        if (!active) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
