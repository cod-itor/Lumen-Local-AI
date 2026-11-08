"use client";

import { useSyncExternalStore } from "react";

/**
 * User preference: how wide conversation columns are (chat, documents,
 * image, learn). Stored per browser; applied as the --chat-width CSS variable
 * on <html>, so every column resizes instantly without re-rendering.
 */
export const CHAT_WIDTH = { min: 560, max: 1200, step: 10, default: 760 } as const;
export const CHAT_WIDTH_KEY = "lumen:chat-width";

const listeners = new Set<() => void>();
let current: number | null = null;

function clamp(n: number) {
  return Math.min(CHAT_WIDTH.max, Math.max(CHAT_WIDTH.min, Math.round(n)));
}

function read(): number {
  if (current !== null) return current;
  try {
    const v = Number(localStorage.getItem(CHAT_WIDTH_KEY));
    current = Number.isFinite(v) && v > 0 ? clamp(v) : CHAT_WIDTH.default;
  } catch {
    current = CHAT_WIDTH.default;
  }
  return current;
}

export function setChatWidth(n: number, persist = true) {
  current = clamp(n);
  document.documentElement.style.setProperty("--chat-width", `${current}px`);
  if (persist) {
    try {
      localStorage.setItem(CHAT_WIDTH_KEY, String(current));
    } catch {
      /* storage blocked: keep the in-memory value */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useChatWidth() {
  return useSyncExternalStore(subscribe, read, () => CHAT_WIDTH.default);
}

/**
 * Inline, constant script for <head>: applies the saved width before first
 * paint so columns don't jump after hydration. Contains no user input.
 */
export const chatWidthBootScript = `try{var w=Number(localStorage.getItem("${CHAT_WIDTH_KEY}"));if(w>=${CHAT_WIDTH.min}&&w<=${CHAT_WIDTH.max})document.documentElement.style.setProperty("--chat-width",w+"px")}catch(e){}`;
