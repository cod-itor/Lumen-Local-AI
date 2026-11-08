"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Animation budget for the current device.
 *
 * "full": desktop-class machine — all decorative motion on.
 * "lite": low-power or small devices — keep entrances, typing, counters;
 *         drop continuous/pointer-driven effects that force the frosted-glass
 *         blur (backdrop-filter) to re-render every frame.
 */
export type PerfTier = "full" | "lite";

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

function detectTier(): PerfTier {
  if (typeof window === "undefined") return "full";
  const nav = navigator as NavigatorHints;
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;
  const saveData = nav.connection?.saveData === true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smallScreen = !window.matchMedia("(min-width: 1024px)").matches;
  const touchOnly = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  return lowCpu || lowMemory || saveData || reducedMotion || smallScreen || touchOnly ? "lite" : "full";
}

let cached: PerfTier | null = null;
const subscribe = () => () => {};
const getSnapshot = () => (cached ??= detectTier());

/** Stable per page load. Server render assumes "lite" so nothing heavy flashes in. */
export function usePerfTier(): PerfTier {
  return useSyncExternalStore(subscribe, getSnapshot, () => "lite");
}

/** False while the browser tab is in the background. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** Marks <html data-perf="lite|full"> so CSS can lighten effects (e.g. glass blur). */
export function PerfTierAttribute() {
  const tier = usePerfTier();
  useEffect(() => {
    document.documentElement.dataset.perf = tier;
  }, [tier]);
  return null;
}
