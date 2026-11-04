"use client";

import { motion, useInView, type HTMLMotionProps } from "motion/react";
import { useRef } from "react";
import { usePageVisible, usePerfTier } from "@/lib/performance";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade-rise on first scroll into view. Only animates opacity/transform. */
export function Reveal({
  delay = 0,
  y = 24,
  className,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={className}
      {...props}
    />
  );
}

/** Card that lifts slightly on hover. */
export function LiftCard({ className, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={className}
      {...props}
    />
  );
}

type GlowTone = "blue" | "orange";

/**
 * Blurred brand glow (Figma "Glow" ellipses). Drifts on a slow transform loop.
 * Position/size via className; colour from --glow-blue / --glow-orange.
 */
export function Glow({
  tone,
  className,
  drift = 40,
  duration = 18,
  blur = 100,
}: {
  tone: GlowTone;
  className?: string;
  drift?: number;
  duration?: number;
  blur?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "200px" });
  const visible = usePageVisible();
  const tier = usePerfTier();
  // Drifting moves pixels under frosted glass, which re-renders the blur each
  // frame — so only drift on capable devices, while on screen, tab visible.
  const drifting = tier === "full" && inView && visible;
  const color = tone === "blue" ? "var(--glow-blue)" : "var(--glow-orange)";
  const t = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0)`;
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none absolute", className)}>
      {/*
        A radial gradient approximates a Gaussian-blurred ellipse without a
        filter, so drifting it is a pure compositor transform.
      */}
      <motion.div
        className="absolute"
        style={{
          inset: -blur,
          backgroundImage: `radial-gradient(closest-side, ${color} 0%, ${color} 20%, transparent 100%)`,
        }}
        animate={
          drifting
            ? { transform: [t(0, 0), t(drift, -drift * 0.7), t(-drift * 0.6, drift * 0.5), t(0, 0)] }
            : { transform: t(0, 0) }
        }
        transition={drifting ? { duration, ease: "easeInOut", repeat: Infinity } : { duration: 0.6 }}
      />
    </div>
  );
}
