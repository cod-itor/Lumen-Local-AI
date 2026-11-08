import type { ClientGuardConfig, LoopConfig } from "@/types/api";

/** Advisory output checks while a browser-side model writes (FRONTEND.md §5); the server repeats all of them. */
export function createClientGuard(cfg: ClientGuardConfig) {
  const patterns = cfg.stopPatterns.flatMap((p) => {
    try {
      return [new RegExp(p, "iu")];
    } catch {
      return [];
    }
  });
  let lastCheckLen = 0;
  return {
    check(text: string): null | { reason: "GUARD_STOP" | "LOOP_STOP" | "LENGTH" } {
      if (text.length > cfg.maxOutputChars) return { reason: "LENGTH" };
      if (text.length - lastCheckLen < cfg.loop.checkEveryChars) return null;
      lastCheckLen = text.length;
      if (patterns.some((r) => r.test(text))) return { reason: "GUARD_STOP" };
      if (hasLoop(text, cfg.loop)) return { reason: "LOOP_STOP" };
      return null;
    },
  };
}

/** Same algorithm as HARNESS.md §8.4; every number comes from rules/harness.yaml → loopDetection. */
export function hasLoop(text: string, cfg: LoopConfig): boolean {
  const w = text.slice(-cfg.windowChars);
  for (let L = cfg.minRepeatLen; L <= cfg.maxRepeatLen; L += cfg.repeatLenStep) {
    const tail = w.slice(-L);
    if (tail.length < L) break;
    let count = 0;
    let from = 0;
    let idx: number;
    while ((idx = w.indexOf(tail, from)) !== -1) {
      count++;
      from = idx + L;
    }
    if (count >= cfg.maxRepeats) return true;
  }
  const lines = w.split("\n").map((l) => l.trim()).filter((l) => l.length >= cfg.sameLineMinChars);
  let run = 1;
  for (let i = 1; i < lines.length; i++) {
    run = lines[i] === lines[i - 1] ? run + 1 : 1;
    if (run >= cfg.sameLineRepeats) return true;
  }
  return false;
}

/** Remove `<think>…</think>` blocks and everything after an unclosed `<think>`; trim leading whitespace. */
export function stripReasoning(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const open = out.indexOf("<think>");
  if (open >= 0) out = out.slice(0, open);
  return out.replace(/^\s+/, "");
}
