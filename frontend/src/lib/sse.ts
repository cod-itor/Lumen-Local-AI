import { apiFetch } from "./api";

/** POST + Server-Sent Events reader (FRONTEND.md §2.3). */
export type SseEvent = { event: string; data: unknown };

export async function* readSse(res: Response): AsyncGenerator<SseEvent> {
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value.replace(/\r\n/g, "\n");
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith(":")) continue; // heartbeat
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) yield { event, data: JSON.parse(data.join("\n")) as unknown };
    }
  }
}

export async function postSse(path: string, body: unknown, signal?: AbortSignal) {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
    headers: { Accept: "text/event-stream" },
  });
  return readSse(res);
}

export const TERMINAL_EVENTS = new Set(["approval", "blocked", "abstained", "prepared", "done", "cancelled", "error"]);
