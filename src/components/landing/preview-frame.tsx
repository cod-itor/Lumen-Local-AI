"use client";

import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EASE } from "./motion";

const W = 1200;
const H = 780;

/**
 * Renders the 1200×780 Figma "Hero Preview" at native size on desktop and
 * scales it down uniformly on narrower screens. Rises/scales in on load.
 */
export function PreviewFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 48, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}
      className="relative mx-auto w-full max-w-[1200px]"
      style={{ height: H * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: W, height: H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </motion.div>
  );
}
