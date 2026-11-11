/** Response helpers for the demo server: the same status codes, error bodies and SSE wire format as the backend. */

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

export function json(body: unknown, status = 200): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export class DemoHttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const fail = (status: number, code: string, message: string, details?: Record<string, unknown>) => {
  throw new DemoHttpError(status, code, message, details);
};

export function errorResponse(e: DemoHttpError, path: string): Response {
  return json(
    { timestamp: new Date().toISOString(), status: e.status, code: e.code, message: e.message, path, details: e.details },
    e.status,
  );
}

export type Emit = (event: string, data: unknown) => void;

/** A text/event-stream Response fed by `run`; it closes when `run` returns or the request is aborted. */
export function sse(run: (emit: Emit) => Promise<void>, signal?: AbortSignal): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const close = () => {
        if (!open) return;
        open = false;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      signal?.addEventListener("abort", close, { once: true });
      const emit: Emit = (event, data) => {
        if (open) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await run(emit);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          emit("error", { code: "INTERNAL_ERROR", message: "Something went wrong in the demo.", retryable: true });
        }
      } finally {
        close();
      }
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
