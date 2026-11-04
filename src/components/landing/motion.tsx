"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
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
      className={cn("will-change-transform", className)}
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
  const reduce = useReducedMotion();
  const color = tone === "blue" ? "var(--glow-blue)" : "var(--glow-orange)";
  const t = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0)`;
  return (
    <div aria-hidden className={cn("pointer-events-none absolute", className)}>
      {/*
        A radial gradient approximates a Gaussian-blurred ellipse without a
        filter, so drifting it is a pure compositor transform.
      */}
      <motion.div
        className="absolute will-change-transform"
        style={{
          inset: -blur,
          backgroundImage: `radial-gradient(closest-side, ${color} 0%, ${color} 20%, transparent 100%)`,
        }}
        animate={
          reduce
            ? undefined
            : { transform: [t(0, 0), t(drift, -drift * 0.7), t(-drift * 0.6, drift * 0.5), t(0, 0)] }
        }
        transition={{ duration, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  );
}
