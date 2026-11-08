# FRONTEND.md — Next.js Frontend Integration and Harness Client

> **Status:** the UI is already built (screens, layout, shadcn/ui components). This file tells the frontend developer exactly
> how to connect every screen to the API (`API_CONTRACT.md`) and how to add the browser-side harness: running the visitor's
> model (WebLLM or their own Ollama), streaming, client guard, and the Model Test page. Do not redesign existing screens.

---

## 1. Stack and conventions (unchanged from the built app)

Next.js App Router + TypeScript (strict), Tailwind + shadcn/ui, TanStack Query, Zustand, react-markdown, react-hook-form + zod, next-intl, pnpm.
New dependencies for this phase: `@mlc-ai/web-llm` (0.2.87 or newer 0.2.x), `remark-gfm`, `rehype-highlight` (if not present).

Rules: all server calls go through `lib/api.ts` / `lib/sse.ts`; all model calls go through `lib/providers/*`; every async UI state has loading, empty and error views; no `any`.

Next.js version note: in Next.js 16, `middleware.ts` was renamed `proxy.ts` (`export function proxy`). Use whichever file your installed version expects; the logic below is the same.

---

## 2. Talking to the backend

### 2.1 Same-origin proxy (Route Handler, not `rewrites`)
External `rewrites()` can buffer Server-Sent Events (compression) and have a default 30-second proxy timeout, which breaks long generations. Use one catch-all Route Handler that streams every request and response, including multipart uploads and `Set-Cookie`:

`src/app/api/[...path]/route.ts`
```ts
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND = process.env.BACKEND_URL!; // e.g. http://localhost:8080
const DROP = new Set([
  'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade',
  'proxy-authorization', 'proxy-authenticate', 'host', 'content-length', 'content-encoding',
]);

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = new URL(`/api/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, BACKEND);

  const headers = new Headers();
  req.headers.forEach((value, key) => { if (!DROP.has(key.toLowerCase())) headers.set(key, value); });

  const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers, redirect: 'manual', cache: 'no-store' };
  if (req.method !== 'GET' && req.method !== 'HEAD') { init.body = req.body; init.duplex = 'half'; }

  const upstream = await fetch(target, init);

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (!DROP.has(k) && k !== 'set-cookie') out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
```
- Remove any `/api/:path*` entry from `next.config` `rewrites()` (the Route Handler replaces it).
- The browser's `Origin` header is forwarded, so the backend's CSRF origin check works (`PUBLIC_URL` = the site origin).
- Voice uses a WebSocket that this proxy cannot carry: connect directly to `NEXT_PUBLIC_WS_URL` (§10).

Env (`.env.local`):
```
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080          # wss://<domain> in production (reverse proxy routes /ws/ to the backend)
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000    # shown in the Ollama setup guide
```

### 2.2 `lib/api.ts`
```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) { super(message); }
}

// Auth endpoints whose 401 means "wrong credentials / no session", never "access token expired".
const NO_REFRESH = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']);

let refreshing: Promise<boolean> | null = null;
async function refreshOnce(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok).finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const res = await fetch(path, { credentials: 'include', ...init, headers: { ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (res.status === 401 && !retried && !NO_REFRESH.has(path.split('?')[0])) {
    if (await refreshOnce()) return apiFetch(path, init, true);
    window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  if (!res.ok && !(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.code ?? 'INTERNAL_ERROR', body.message ?? 'Something went wrong.', body.details);
  }
  return res;
}

export const api = {
  get: <T>(p: string) => apiFetch(p).then((r) => r.json() as Promise<T>),
  post: <T>(p: string, body?: unknown) => apiFetch(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => (r.status === 204 ? (undefined as T) : r.json())),
  patch: <T>(p: string, body: unknown) => apiFetch(p, { method: 'PATCH', body: JSON.stringify(body) }).then((r) => r.json() as Promise<T>),
  put: <T>(p: string, body: unknown) => apiFetch(p, { method: 'PUT', body: JSON.stringify(body) }).then((r) => r.json() as Promise<T>),
  del: (p: string) => apiFetch(p, { method: 'DELETE' }).then(() => undefined),
};
```
- Copy every type of API_CONTRACT §4 into `src/types/api.ts` verbatim.
- Map `ApiError.code` to user messages with one table (`lib/errors.ts`); `message` from the server is already user-safe and is the default.
- Send `X-Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` on register.

### 2.3 `lib/sse.ts` (POST + SSE)
```ts
export type SseEvent = { event: string; data: unknown };

export async function* readSse(res: Response): AsyncGenerator<SseEvent> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value.replace(/\r\n/g, '\n');
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 2);
      let event = 'message'; const data: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith(':')) continue;                     // heartbeat
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (data.length) yield { event, data: JSON.parse(data.join('\n')) };
    }
  }
}

export async function postSse(path: string, body: unknown, signal?: AbortSignal) {
  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body), signal, headers: { Accept: 'text/event-stream' } });
  return readSse(res);
}
```
Terminal events (API_CONTRACT §5.1): `approval, blocked, abstained, prepared, done, cancelled, error`. If the generator ends without one, call `GET /api/harness/turns/{turnId}` and recover (§4.3).

---

## 3. Providers in the browser (`lib/providers/`)

### 3.1 Interface
```ts
// lib/providers/types.ts
import type { ChatMessage, GenParams, ModelProfile } from '@/types/api';

export interface GenerateRequest {
  messages: ChatMessage[]; params: GenParams; schema: object | null; profile: ModelProfile; signal: AbortSignal;
}
export interface GenerateChunk { text: string }
export interface GenerateDone {
  finishReason: 'STOP' | 'LENGTH' | 'ABORTED';
  stats: { model: string; ttftMs: number | null; tokensPerSec: number | null; outputTokens: number | null; promptTokens: number | null; totalMs: number | null };
}
export interface ClientModelProvider {
  kind: 'BROWSER' | 'LOCAL_OLLAMA';
  model: string;
  ensureReady(onProgress?: (p: number, text: string) => void): Promise<void>;
  generate(req: GenerateRequest): AsyncGenerator<GenerateChunk, GenerateDone>;
}
```
`lib/providers/registry.ts` exposes `providerRegistry.get(provider: ProviderDto): Promise<ClientModelProvider>`: LOCAL_OLLAMA → `ollamaProvider(baseUrl, model)` (§3.3); BROWSER → look up `provider.model` in the cached catalog and return `webllmProvider(pickBuild(entry, f16))` (§3.4–3.5). One instance per provider id, created lazily.

### 3.2 Preparing messages for a profile (`lib/providers/messages.ts`)
```ts
export function applyProfile(messages: ChatMessage[], profile: ModelProfile): ChatMessage[] {
  if (profile.systemRole || messages[0]?.role !== 'system') return messages;
  const [system, ...rest] = messages;
  const i = rest.findIndex((m) => m.role === 'user');
  if (i < 0) return [{ role: 'user', content: system.content }];
  const merged = { role: 'user' as const, content: `[Instructions]\n${system.content}\n\n[Message]\n${rest[i].content}` };
  return [...rest.slice(0, i), merged, ...rest.slice(i + 1)];
}
```

### 3.3 LOCAL_OLLAMA (`lib/providers/ollama.ts`)
```ts
export function ollamaProvider(baseUrl: string, model: string): ClientModelProvider {
  return {
    kind: 'LOCAL_OLLAMA', model,
    async ensureReady() { /* nothing: Ollama loads the model on first request */ },
    async *generate({ messages, params, schema, profile, signal }) {
      const started = performance.now();
      const body: Record<string, unknown> = {
        model, stream: true, keep_alive: '10m',
        messages: applyProfile(messages, profile),
        options: { temperature: params.temperature, top_p: params.topP, min_p: params.minP ?? undefined,
                   num_predict: params.maxTokens, num_ctx: params.numCtx, repeat_penalty: params.repeatPenalty,
                   stop: params.stop, seed: params.seed ?? undefined },
      };
      if (schema && profile.jsonSchema) body.format = schema;
      if (profile.disableThinking === 'OLLAMA_THINK_FALSE') body.think = false;

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
        // Chrome Local Network Access: declare the loopback target (ignored by browsers that don't support it)
        targetAddressSpace: 'loopback',
      } as RequestInit);
      if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buf = ''; let ttft: number | null = null; let last: any = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line) continue;
          const obj = JSON.parse(line);
          if (obj.error) throw new Error(obj.error);
          const text: string = obj.message?.content ?? '';
          if (text) { ttft ??= performance.now() - started; yield { text }; }
          if (obj.done) last = obj;
        }
      }
      const evalSec = last?.eval_duration ? last.eval_duration / 1e9 : null;
      return {
        finishReason: last?.done_reason === 'length' ? 'LENGTH' : 'STOP',
        stats: { model, ttftMs: ttft && Math.round(ttft), outputTokens: last?.eval_count ?? null, promptTokens: last?.prompt_eval_count ?? null,
                 tokensPerSec: evalSec ? +(last.eval_count / evalSec).toFixed(1) : null, totalMs: Math.round(performance.now() - started) },
      };
    },
  };
}
```
An aborted `fetch` throws `AbortError`; the caller turns that into `finishReason: 'ABORTED'` (§4.2).

### 3.4 BROWSER (WebLLM)
Worker `src/lib/providers/webllm.worker.ts`:
```ts
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
```
Engine manager `src/lib/providers/webllm.ts` (a singleton; one model loaded at a time):
```ts
import { CreateWebWorkerMLCEngine, prebuiltAppConfig, type WebWorkerMLCEngine } from '@mlc-ai/web-llm';

let engine: WebWorkerMLCEngine | null = null;
let loadedId: string | null = null;

export async function getEngine(modelId: string, onProgress?: (p: number, text: string) => void) {
  if (engine && loadedId === modelId) return engine;
  if (engine) { await engine.reload(modelId); loadedId = modelId; return engine; }
  engine = await CreateWebWorkerMLCEngine(
    new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' }),
    modelId,
    { initProgressCallback: (r) => onProgress?.(r.progress, r.text), appConfig: { ...prebuiltAppConfig, cacheBackend: 'cache' } },
  );
  loadedId = modelId;
  return engine;
}

export function webllmProvider(modelId: string): ClientModelProvider {
  return {
    kind: 'BROWSER', model: modelId,
    async ensureReady(onProgress) { await getEngine(modelId, onProgress); },
    async *generate({ messages, params, schema, profile, signal }) {
      const eng = await getEngine(modelId);
      const started = performance.now();
      const onAbort = () => eng.interruptGenerate();
      signal.addEventListener('abort', onAbort, { once: true });
      const stream = await eng.chat.completions.create({
        messages: applyProfile(messages, profile), stream: true, stream_options: { include_usage: true },
        temperature: params.temperature, top_p: params.topP, max_tokens: params.maxTokens, stop: params.stop,
        repetition_penalty: params.repeatPenalty, seed: params.seed ?? undefined,
        ...(schema && profile.jsonSchema ? { response_format: { type: 'json_object', schema: JSON.stringify(schema) } } : {}),
        ...(profile.disableThinking === 'WEBLLM_EXTRA_BODY' ? { extra_body: { enable_thinking: false } } : {}),
      });
      let usage: any = null; let finish: string | null = null; let ttft: number | null = null;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) { ttft ??= performance.now() - started; yield { text: delta }; }
        finish = chunk.choices[0]?.finish_reason ?? finish;
        if (chunk.usage) usage = chunk.usage;
      }
      signal.removeEventListener('abort', onAbort);
      return {
        finishReason: finish === 'abort' ? 'ABORTED' : finish === 'length' ? 'LENGTH' : 'STOP',
        stats: { model: modelId, ttftMs: ttft && Math.round(ttft), outputTokens: usage?.completion_tokens ?? null, promptTokens: usage?.prompt_tokens ?? null,
                 tokensPerSec: usage?.extra?.decode_tokens_per_s ? +usage.extra.decode_tokens_per_s.toFixed(1) : null,
                 totalMs: Math.round(performance.now() - started) },
      };
    },
  };
}
```
- **Which build to load:** the provider stores the catalog entry `id`. The provider registry (§3.1) builds `webllmProvider(pickBuild(entry, (await webgpuSupport()).f16))` when it creates the provider in this browser (§3.5), so the same account loads the q4f16 build on Chrome with `shader-f16` and the q4f32 fallback on Firefox. `stats.model` reports the build actually used.
- Cache helpers for the Models page: `hasModelInCache(id)`, `deleteModelAllInfoInCache(id)` from `@mlc-ai/web-llm` (check and delete both builds of an entry).
- Model weights download from `huggingface.co/mlc-ai/<id>` and WASM libraries from `raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/...` (CSP §9).

### 3.5 WebGPU detection and model choice (`lib/providers/webgpu.ts`)
```ts
export async function webgpuSupport(): Promise<{ ok: boolean; f16: boolean; reason?: string }> {
  if (!('gpu' in navigator)) return { ok: false, f16: false, reason: 'NO_WEBGPU' };
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) return { ok: false, f16: false, reason: 'NO_ADAPTER' };
  return { ok: true, f16: adapter.features.has('shader-f16') };
}
// Every q4f16 build needs shader-f16: use catalog.id when f16 is true, otherwise catalog.fallbackId (q4f32).
export const pickBuild = (m: BrowserModelDto, f16: boolean) => (f16 ? m.id : m.fallbackId);
```
Show the GPU memory requirement (`vramMb` / `fallbackVramMb`) next to each model. WebGPU is available in current Chrome/Edge (desktop, Android 12+), Safari 26+, and Firefox on Windows and Apple-silicon Macs; Firefox lacks `shader-f16`, so it always uses the q4f32 fallback builds.

---

## 4. The harness turn hook (`lib/harness/useHarnessTurn.ts`)

### 4.1 State
```ts
type TurnPhase = 'idle' | 'preparing' | 'approval' | 'loadingModel' | 'generating' | 'finalizing' | 'done' | 'error';
interface TurnState {
  phase: TurnPhase; turnId?: string; stage?: TurnStage; streamText: string;      // visible text (reasoning removed)
  sources: SourceDto[]; tools: ToolResultDto[]; approval?: ApprovalEvent;
  result?: TurnResult; error?: { code: string; message: string; retryable: boolean };
  userMessage?: MessageDto; modelProgress?: { p: number; text: string };
}
```
API: `start(req: HarnessTurnRequest)`, `approve(decision: 'APPROVE' | 'EDIT', content?)`, `stop()`, `reset()`.

### 4.2 Algorithm
```
start(req):
  lastRequest = req                                                       (Retry repeats it, §4.3)
  if current provider is BROWSER and its engine is not loaded:             (download/load BEFORE the turn exists,
    phase = loadingModel; await provider.ensureReady(progress)              so the turn's 10-minute lifetime and the chat lock
    (Stop here simply ends the loading wait; no turn exists yet)            are not used up by a first download)
  phase = preparing
  for await (ev of postSse('/api/harness/turns', req, abort.signal)):
    turn      → save turnId, userMessage (insert into the chat list immediately)
    status    → stage (drives the status line / search steps; QUEUED shows "Waiting for the model… (position {detail})")
    sources   → sources
    tools     → tools
    approval  → phase = approval; return                                  (UI shows ApprovalCard)
    blocked   → result = { status: 'BLOCKED', message: ev.message, notice: ev.refusal, guardAction: ev.action }; phase = done; return
    abstained → result = { status: 'ABSTAINED', message: ev.message }; phase = done; return
    prepared  → await clientGenerate(ev); return                          (CLIENT providers)
    token     → phase = generating; streamText += ev.text                 (SERVER providers)
    retry     → streamText = ''; status line "Fixing the format…" (INVALID) or "Trying again…" (EMPTY)   (SERVER providers)
    done      → finish(ev); return                                        (TurnResult; SERVER providers)
    cancelled → phase = idle; refetch chat messages; return
    error     → error = ev; phase = error; return
  stream ended without terminal → recover()

clientGenerate(prepared, extraMessages = [], attempt = prepared.attempt):
  provider = await providerRegistry.get(currentProvider)                  (§3.1)
  phase = loadingModel
  try: await provider.ensureReady(progress)                               (WebLLM download/load)
  catch e → return clientFailed(e)
  if stopRequested → return cancelTurn()                                  (Stop pressed while loading)
  phase = generating; raw = ''; visible = ''; finishReason = 'STOP'
  guard = createClientGuard(prepared.clientGuard)                          (§5)
  try:
    gen = provider.generate({ messages: [...prepared.messages, ...extraMessages], params, schema: prepared.outputSchema, profile: prepared.modelProfile, signal })
    for each chunk: raw += chunk.text; visible = stripReasoning(raw); streamText = visible
                    if guard.check(visible) → stop generation, finishReason = guard.reason ('GUARD_STOP' | 'LOOP_STOP' | 'LENGTH')
    done = generator return value (finishReason from the provider unless the guard stopped it)
  catch AbortError → finishReason = 'ABORTED'
  catch other → if no text yet and this is the first try: retry once automatically; else return clientFailed(err)
  if finishReason == 'ABORTED' and (task != 'MESSAGE' or visible.trim() == '') → return cancelTurn()
  phase = finalizing
  try:
    result = POST /api/harness/turns/{turnId}/complete { content: raw, finishReason, stats, attempt }
    finish(result)
  catch ApiError 422 SCHEMA_INVALID (details.attemptsLeft > 0):
    streamText = ''; status line "Fixing the format…" (reason INVALID) or "Trying again…" (reason EMPTY)
    return clientGenerate(prepared, [...extraMessages, ...details.repairMessages], attempt + 1)
  catch ApiError 410 TURN_EXPIRED → error = { code, message, retryable: true }
  catch other ApiError → error

clientFailed(err):                                                       (model crashed, Ollama unreachable, …)
  POST /api/harness/turns/{turnId}/cancel { reason: 'CLIENT_ERROR', errorCode: 'PROVIDER_ERROR' }   (best effort; frees the chat lock)
  error = { code: 'PROVIDER_ERROR', message: provider.describe(err), retryable: true }; phase = error
  for LOCAL_OLLAMA also offer "Test connection" (§8.2)

cancelTurn():
  POST /api/harness/turns/{turnId}/cancel                                (reason USER)
  phase = idle; refetch chat messages (MESSAGE: the user message shows "No answer saved" + Retry)

finish(result: TurnResult):
  COMPLETED | BLOCKED | ABSTAINED → MESSAGE: replace the streamed text with result.message;
                                    other tasks: use result.data, or show result.notice when BLOCKED
                                    (guardAction SUPPORT → the calm support card of §6.5, not an error); phase = done
  FAILED    → phase = error; error = { code: 'FAILED', message: result.notice, retryable: true }
  CANCELLED → phase = idle; refetch chat messages

stop():
  stopRequested = true
  phase loadingModel                → cancelTurn() (the model keeps loading in the background for next time)
  phase generating, CLIENT provider → abort the local generation (clientGenerate then completes with ABORTED or cancels, above)
  phase generating, SERVER provider → POST /cancel and keep reading the stream: it ends with `done` (partial answer saved as STOPPED)
                                      or `cancelled`; if nothing arrives within 5 s, abort the fetch and recover()
  phase preparing                   → POST /cancel (the open stream then ends with `cancelled`)
  phase approval                    → cancelTurn() (the stream already closed after `approval`)

recover():
  repeat up to 3 times, 1 s apart: t = GET /api/harness/turns/{turnId}; stop when t.status is terminal
  if t.status is terminal (COMPLETED, BLOCKED, ABSTAINED, CANCELLED, EXPIRED, FAILED) → refetch chat messages (or the task's target); phase = done
  else → POST /cancel (frees the lock so Retry is not refused with 409; a SERVER answer in progress is saved as STOPPED),
         refetch chat messages, error { code: 'STREAM_INTERRUPTED', retryable: true }
```
`stripReasoning(text)`: remove `<think>…</think>` blocks and everything after an unclosed `<think>`; trim leading whitespace.

On `done`, the message list replaces the streamed text with `result.message` (the server's version may differ: auto-citations, removed links, translations, refusals).

### 4.3 Retry rules in the UI
- `error.retryable` (including `FAILED` results and `PROVIDER_ERROR`) → Retry button. MESSAGE: if `lastRequest.regenerateOf` is set, call `start({ task: 'MESSAGE', chatId, providerId, regenerateOf: lastRequest.regenerateOf })` (the earlier answer still exists); otherwise `start({ task: 'MESSAGE', chatId, providerId, answerOf: userMessage.id })` (`userMessage` from the `turn` event). Other tasks re-run `start(lastRequest)`.
- After a page reload, a user message without an answer shows "No answer saved" + Retry with `answerOf`; a failed regenerate leaves the earlier answer, which can simply be regenerated again.
- `TURN_EXPIRED` on complete → same Retry.
- `409 CONFLICT` on start → toast with the server's message ("Another request for this item is still running.").

---

## 5. Client guard (`lib/harness/clientGuard.ts`)
```ts
export function createClientGuard(cfg: ClientGuardConfig) {
  const patterns = cfg.stopPatterns.map((p) => new RegExp(p, 'iu'));
  let lastCheckLen = 0;
  return {
    check(text: string): null | { reason: 'GUARD_STOP' | 'LOOP_STOP' | 'LENGTH' } {
      if (text.length > cfg.maxOutputChars) return { reason: 'LENGTH' };
      if (text.length - lastCheckLen < cfg.loop.checkEveryChars) return null;
      lastCheckLen = text.length;
      if (patterns.some((r) => r.test(text))) return { reason: 'GUARD_STOP' };
      if (hasLoop(text, cfg.loop)) return { reason: 'LOOP_STOP' };
      return null;
    },
  };
}

// Same algorithm as HARNESS.md §8.4; every number comes from cfg (rules/harness.yaml → loopDetection).
export function hasLoop(text: string, cfg: LoopConfig): boolean {
  const w = text.slice(-cfg.windowChars);
  for (let L = cfg.minRepeatLen; L <= cfg.maxRepeatLen; L += cfg.repeatLenStep) {
    const tail = w.slice(-L);
    if (tail.length < L) break;
    let count = 0, from = 0, idx: number;
    while ((idx = w.indexOf(tail, from)) !== -1) { count++; from = idx + L; }
    if (count >= cfg.maxRepeats) return true;
  }
  const lines = w.split('\n').map((l) => l.trim()).filter((l) => l.length >= cfg.sameLineMinChars);
  let run = 1;
  for (let i = 1; i < lines.length; i++) {
    run = lines[i] === lines[i - 1] ? run + 1 : 1;
    if (run >= cfg.sameLineRepeats) return true;
  }
  return false;
}
```
The client guard is advisory; the server repeats all checks.

---

## 6. Rendering assistant messages

### 6.1 Markdown (`components/common/MarkdownRenderer.tsx`)
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight]}
  disallowedElements={['img']}          // never render images from model output
  unwrapDisallowed={false}
  components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>, /* + code block with copy button */ }}
>{content}</ReactMarkdown>
```
Never add `rehype-raw`. Keep the default `urlTransform` (it blocks `javascript:` and other unsafe schemes). Khmer text uses Noto Sans Khmer (font stack) and `line-height ≥ 1.8`.

### 6.2 Citations and grounding
- Replace `[n]` (and `[n, m]`) in rendered text with `<CitationChip n>` (a remark plugin or post-processing of text nodes). Clicking scrolls the right sidebar to source `n` and highlights it; for DOC sources it opens the document viewer at `page` and highlights the chunk (`GET /api/documents/{id}/chunks/{chunkId}` → offsets in `GET /api/documents/{id}/text?page=`).
- Grounding badge under the answer from `meta.grounding.level`: GROUNDED "Checked against sources", PARTIAL "Partly checked", UNGROUNDED "Not supported by sources" (warning colour). Hidden for NOT_APPLICABLE and ABSTAINED.
- Unsupported sentences: `sentences[].start/end` are UTF-16 offsets (plain JS string indexes) into `originalContent` when it is non-null, else into `content`. When the bubble shows a translation (`content` in Khmer), show only the badge and the "Show original" toggle; draw the underlines on the original text. Wrap those spans with a dotted underline and a tooltip from `issue` (`NUMBER_NOT_IN_SOURCE` → "This number isn't in the sources", `LOW_SUPPORT` → "Not found in the sources", `NO_CITATION` → "No source given", `QUOTE_NOT_IN_SOURCE` → "Quote not found in the sources"). Apply the wrapping before Markdown parsing by inserting marker tokens, or render plain text for those spans.
- `meta.grounding.hasSpecificFacts` (CHAT): small note "Contains details that weren't checked" + button "Check with web search" (re-asks the same question with `webSearch: true`).
- `meta.tools`: a small "Calculated by the app" card listing tool results.

### 6.3 Suggestions (`meta.suggestions`)
| Type | Chip action |
|---|---|
| `TURN_ON_WEB_SEARCH` / `VERIFY_WITH_WEB_SEARCH` | toggle web search on and re-ask the last question |
| `OPEN_IMAGE_TAB` | navigate to `/image` and prefill the prompt with `payload.request` |
| `START_LEARNING_PATH` | navigate to `/learn` with `payload.goal` prefilled |
| `UPLOAD_DOCUMENT` | open the upload dialog in the Documents tab |
| `ASK_MY_DOCUMENTS` | navigate to `/docs` (new doc chat) with the question prefilled |
| `SWITCH_TO_HOST_MODEL` | open the model picker with the HOST provider highlighted |

### 6.4 Languages
- `meta.outputLanguage = BOTH`: show `content` (English) and `translations.KM` side by side (stacked on mobile).
- `originalContent` present: a "Show original" toggle.
- "Translate" action → `POST /api/messages/{id}/translate { target }` → show the result under the message (and cache in the query cache).

### 6.5 Statuses
- `BLOCKED`: muted card with the refusal text, no regenerate.
- `meta.guard.action = SUPPORT`: soft highlighted card, no regenerate, no feedback buttons.
- `ABSTAINED`: normal bubble + suggestion chips.
- `STOPPED`: "Stopped" label + Continue? (no; just Regenerate).
- User message without an answer (a failed, cancelled or expired turn; no assistant message is saved): "No answer saved" + Retry (`answerOf`). During the live session also show the `notice` or `error.message` that ended the turn.
- Speed stats (if `settings.showSpeedStats`): `ttft 0.6 s · 31 tok/s · model` under the message.

---

## 7. Screens → endpoints

### 7.1 Auth pages
| Action | Call |
|---|---|
| Register | `POST /api/auth/register` (+ header `X-Timezone`) → store `MeResponse` in the session store → go to `next` or `/chat` |
| Login | `POST /api/auth/login` |
| Logout | `POST /api/auth/logout` → clear query cache → `/login` |
| App load | `GET /api/auth/me` (401 → refresh flow) |
Route protection (`src/proxy.ts`, Next.js 16's name for middleware): on app routes, if neither the `access_token` nor the `session_hint` cookie is present → redirect `/login?next=…`. (`refresh_token` is scoped to `/api/auth` and is never sent with page requests, so it cannot be checked here.) With only `session_hint`, the page loads and the first API call's 401 triggers the refresh in `lib/api.ts`.

### 7.2 App shell
| UI | Data |
|---|---|
| Left sidebar history | `GET /api/chats?tab=CHAT|DOCS&page=0&size=30` (infinite query, `q` for search); rename `PATCH /api/chats/{id}`; delete `DELETE /api/chats/{id}` |
| New chat | `POST /api/chats { tab }` → navigate to `/chat/{id}` |
| Model picker (top bar) | `GET /api/providers` + `GET /api/providers/catalog` (cache 1 h); current provider in Zustand (default = `isDefault`); status dot from provider status + engine state |
| Model status badge | `GET /api/system/status` every 30 s (TanStack `refetchInterval`) |
| Feature badges | `status.ai.features` (images, voice, webSearch…) — disable buttons with a tooltip when off |
| Settings | `GET/PATCH /api/settings` |

### 7.3 Chat tab
| Action | Call |
|---|---|
| Open chat | `GET /api/chats/{id}/messages` → build the tree; render the path from `activeLeafId` to the root |
| Send | `useHarnessTurn.start({ task: 'MESSAGE', chatId, providerId, content, webSearch, outputLanguage })` |
| Regenerate | `start({ task: 'MESSAGE', chatId, providerId, regenerateOf: assistantId })` |
| Edit user message | `start({ task: 'MESSAGE', chatId, providerId, editOf: userMsgId, content })` |
| Switch version `< 1/2 >` | compute the deepest leaf under the chosen sibling (follow the newest child) → `PATCH /api/chats/{id} { activeLeafId }` |
| Stop | `stop()` |
| Web search approval | ApprovalCard → `approve('APPROVE')` / `approve('EDIT', query)` (both `POST /api/harness/turns/{id}/approval`, SSE continues) / Cancel → `POST /api/harness/turns/{id}/cancel` |
| Feedback | `POST /api/messages/{id}/feedback` |
| Title | after the first `done` in a chat with `titleSource` DEFAULT/AUTO: background `start({ task: 'TITLE', providerId, target: { type: 'CHAT', id } })` (skip for BROWSER if the engine is not loaded) → invalidate the chats list |
Right sidebar: search steps from `status` events (`SEARCHING`, `READING`) and source cards from `sources`.

### 7.4 Documents tab
| Action | Call |
|---|---|
| Upload | `POST /api/documents` (FormData `file`) → `UploadResponse`; if `duplicate` → toast "Already in your library" and select that document; else subscribe `GET /api/jobs/{jobId}/events` → progress bar (`PARSING` → `EMBEDDING` → done/error) |
| Library | `GET /api/documents` |
| Upload progress, cancel, recovery | During the upload session keep `UploadResponse.jobId`: Cancel button → `POST /api/jobs/{jobId}/cancel`; if the job event stream drops, read `GET /api/jobs/{jobId}` once and resubscribe if it is still `QUEUED`/`RUNNING`. After a page reload (no `jobId`), poll `GET /api/documents/{id}` every 2 s for documents in `UPLOADED`/`PARSING`/`EMBEDDING` until `READY`/`FAILED` |
| Pick documents for a chat | `PATCH /api/chats/{id} { documentIds }` (only READY documents) |
| Ask | same as Chat send (the chat's tab is DOCS; no web toggle) |
| Viewer | PDF: `GET /api/documents/{id}/file` in a PDF viewer component (e.g. `react-pdf`) with the chunk text highlighted using `ChunkDto` offsets on `GET /api/documents/{id}/text?page=`; other types: render the page text with a highlighted span |
| Delete | `DELETE /api/documents/{id}` |

### 7.5 Image tab
| Step | Call |
|---|---|
| Session | `GET/POST /api/image-sessions`; rename `PATCH /api/image-sessions/{id}`; delete `DELETE /api/image-sessions/{id}` |
| Clarify | `start({ task: 'IMAGE_CLARIFY', providerId, target: { type: 'IMAGE_SESSION', id }, taskInput: { request } })` → `result.data.questions` (empty → skip to prompt) |
| Questions UI | option chips per question + Skip |
| Prompt rewrite | `start({ task: 'IMAGE_PROMPT', …, taskInput: { request, answers, style } })` → ApprovalCard with editable `prompt` (Generate / Use my original / Cancel). "Use my original" sends `prompt = result.data.originalPromptEnglish` (the image model needs English) and `originalPrompt = result.data.originalPrompt` |
| Generate | `POST /api/images/generate { sessionId, prompt, originalPrompt, aspectRatio, count, seed, steps }` → `{ jobId }` → `GET /api/jobs/{jobId}/events` → on done prepend `result.images` to the grid |
| Gallery | `GET /api/images?sessionId=`; each `<img src>` = `ImageDto.url` (`/api/files/images/{id}`, same-origin, cookie-authenticated); delete `DELETE /api/images/{id}`; long-running job → Cancel `POST /api/jobs/{id}/cancel` |
| Variations / Remove background | `POST /api/images/{id}/variations` / `POST /api/images/{id}/remove-background` → job events |
| Disabled state | `status.ai.features.images` false → disable Generate and Variations with "Image generation needs the host machine" (clarify and prompt still work); `status.ai.features.bgRemoval` false → hide Remove background |
| Guardrails | `400 GUARD_BLOCKED` on generate → show `details.refusal`; when `details.action = SUPPORT` use the calm support card (§6.5), not an error toast |

### 7.6 Learning paths
List and create: `GET /api/learning-paths` (left sidebar list); new path → `POST /api/learning-paths { goal }`; open → `GET /api/learning-paths/{id}`; delete → `DELETE /api/learning-paths/{id}`. Opening a step → `GET /api/learning-steps/{id}`; past quiz attempts → `GET /api/learning-steps/{id}/quizzes`.

Drive the UI by `LearningPathDto.nextAction` (API_CONTRACT §6.9):
| `nextAction` | Do |
|---|---|
| `ASK` | `start({ task: 'LEARN_QUESTION', providerId, target: { type: 'LEARNING_PATH', id } })` → updated path |
| `NONE` + pending question | show question + option chips; answer → `POST /api/learning-paths/{id}/answers`; "That's enough, make the plan" → `POST /api/learning-paths/{id}/skip-interview` |
| `PLAN` | `start({ task: 'LEARN_PLAN', … })` → plan card |
| `APPROVE` | editable plan card → `PUT /api/learning-paths/{id}/plan` on edit, `POST /api/learning-paths/{id}/approve` on approve, `POST /api/learning-paths/{id}/restart` on start over |
| `STUDY` | stepper; opening a step with `contentStatus = EMPTY` → `start({ task: 'LEARN_STEP', target: { type: 'LEARNING_STEP', id } })`; `contentStatus = FAILED` → "The lesson couldn't be written with this model." + Try again (same call); "Take the quiz" → `start({ task: 'QUIZ', target: { type: 'LEARNING_STEP', id }, taskInput: { count: 5 } })` → quiz card → `POST /api/quizzes/{id}/submit` → results + next step unlock |
Show "AI-written lesson — check important facts" above each lesson. Lessons, plans and quizzes are in English in v1 (HARNESS.md §6.3 Scope); a Khmer UI shows a small note "Lessons are in English for now". Creating a path: `400 GUARD_BLOCKED` → show `details.refusal` (support style when `details.action = SUPPORT`).

### 7.7 Model Test (`/test`)
| Step | Call |
|---|---|
| Suites | `GET /api/evals/suites` |
| Start | `POST /api/evals/runs { providerId, suite: 'core', mode }` → `caseIds` |
| Run | for each case id in order that has no result yet: `start({ task: 'EVAL_CASE', providerId, target: { type: 'EVAL_RUN', id }, taskInput: { caseId } })` → `result.data` = `EvalResultDto`; on `FAILED`/error retry that case once, then continue (the backend stores an error result); stop when the run is no longer RUNNING (5 error results → `FAILED`); progress bar = `completedCases / caseIds.length`; Pause = stop looping (resume later from History); Cancel = `POST /api/evals/runs/{id}/cancel` |
| Scorecard | `GET /api/evals/runs/{id}` → overall label + score, category bars, safety-with-guardrails, speed, failed cases (expandable: output + failed checks) |
| History / compare | `GET /api/evals/runs?providerId=` → pick two runs → side-by-side bars |
The run keeps going if the user navigates within the app (store the runner in a Zustand store, not in the page component).

### 7.8 Settings → Models (`/settings/models`)
| UI | Call |
|---|---|
| List | `GET /api/providers` |
| Add "In your browser" | choose from `catalog.browser.models` (WebGPU check §3.5) → `POST /api/providers { kind: 'BROWSER', name, model }` → download with progress (`ensureReady`) → `POST /api/providers/{id}/test-result` |
| Add "My Ollama" | guide (§8) → Test connection → choose a model from the test's model list → `POST /api/providers { kind: 'LOCAL_OLLAMA', name, baseUrl, model }` → `POST /test-result` |
| Add "Remote URL" (only if enabled) | form → `POST /api/providers { kind: 'REMOTE_URL', … }` → `POST /api/providers/{id}/test` |
| Default | `POST /api/providers/{id}/default` |
| Delete | `DELETE /api/providers/{id}`; BROWSER also offers "Remove downloaded files" (`deleteModelAllInfoInCache`) |

### 7.9 Settings → General, Admin
- General: `PATCH /api/settings` (theme, UI language, output language, answer length, temperature slider, ask-before-search, guard profile STANDARD/STRICT, show speed stats). Account deletion: `DELETE /api/users/me { password }`.
- Admin (`role = ADMIN`, route `/admin`, hidden for other users): stats cards `GET /api/admin/stats`; guard events table `GET /api/admin/guard-events?page=&size=&stage=&category=`; feedback table `GET /api/admin/feedback?page=&size=&rating=`; "Reload rules" button `POST /api/admin/reload-rules` (shows the new `rulesVersion`).

---

## 8. "Connect my Ollama" guide and connection test

### 8.1 Guide text (OS tabs, with copy buttons; `{ORIGIN}` = `NEXT_PUBLIC_APP_ORIGIN`)
1. Install Ollama from ollama.com and open it.
2. Download a model (suggestions from `catalog.ollamaSuggestions`): `ollama pull qwen3.5:2b`
3. Allow this website (once), then restart Ollama:
   - **macOS:** `launchctl setenv OLLAMA_ORIGINS "{ORIGIN}"` — then quit Ollama from the menu bar and open it again.
   - **Windows:** quit Ollama → Start menu → "Edit environment variables for your account" → New → name `OLLAMA_ORIGINS`, value `{ORIGIN}` → OK → start Ollama again.
   - **Linux:** `sudo systemctl edit ollama.service` → add under `[Service]`: `Environment="OLLAMA_ORIGINS={ORIGIN}"` → `sudo systemctl daemon-reload && sudo systemctl restart ollama`.
   - Already have other origins? Add ours separated by a comma **without spaces**.
   - Never use `*` — that lets every website use your model.
4. Click **Test connection**. If your browser asks to allow access to devices on your network or apps on this device, click **Allow**.
5. Use Chrome, Edge or Firefox. **Safari blocks secure websites from talking to `localhost`**, so this option does not work in Safari (use "In your browser" instead).

### 8.2 Test connection (`lib/providers/ollamaTest.ts`) — checks in order, stop at the first failure
1. **Browser:** Safari (no `loopback-network` permission support and UA contains `Safari` but not `Chrome`/`Chromium`/`Firefox`) → fail "Safari can't connect to local apps. Use Chrome, Edge or Firefox."
2. **Permission state** (Chromium/Firefox): `try { const s = await navigator.permissions.query({ name: 'loopback-network' } as any); if (s.state === 'denied') fail('Your browser blocked access. Click the icon at the left of the address bar and allow access to apps on this device.') } catch { /* name not supported: ignore */ }`. Do **not** query the old name `local-network-access`.
3. **Reach + CORS:** `fetch(baseUrl + '/api/version', { targetAddressSpace: 'loopback' })`:
   - OK → continue.
   - Throws → probe `fetch(baseUrl + '/api/version', { mode: 'no-cors', targetAddressSpace: 'loopback' })`: if the probe resolves, Ollama is running but blocks this website → fail "Ollama isn't allowing this website yet. Do step 3 of the guide, then restart Ollama." If the probe also throws → fail "Can't reach Ollama. Make sure it is running (and allow access if your browser asks)."
4. **Models:** `GET /api/tags` → `models[].name`; none → fail "No models yet. Run `ollama pull qwen3.5:2b`."
5. **Model info** (for the chosen model): `POST /api/show { model }` → `modelInfo` (family, parameter size, quantization, context length from `model_info` keys ending in `.context_length`).
6. **Generation:** `POST /api/chat { model, stream: false, messages: [{ role: 'user', content: 'Reply with the word OK.' }], options: { num_predict: 5 } }` → pass if the reply contains "ok" (case-insensitive) → otherwise fail "The model didn't answer. Check the Ollama window for errors."
Report the result list to `POST /api/providers/{id}/test-result`.

---

## 9. Security headers (`next.config` `headers()`)
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';            (dev also needs 'unsafe-eval' for Next.js HMR)
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' http://localhost:* http://127.0.0.1:* https://huggingface.co https://cdn-lfs.huggingface.co
              https://cdn-lfs-us-1.huggingface.co https://cdn-lfs-us-1.hf.co https://cas-bridge.xethub.hf.co
              https://raw.githubusercontent.com <NEXT_PUBLIC_WS_URL origin>;
  worker-src 'self' blob:;
  media-src 'self' blob:;                                          (read-aloud audio, §10 step 8)
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
Referrer-Policy: same-origin
X-Content-Type-Options: nosniff
Permissions-Policy: microphone=(self), camera=()
```
- `img-src` without external hosts is the last line of defense against image-based data exfiltration.
- If WebLLM downloads fail with CSP errors in the console, add the reported Hugging Face redirect host to `connect-src` (CSP is checked on every redirect).
- A nonce-based CSP (Next.js guide) can replace `'unsafe-inline'` for scripts later; it is acceptable now because no raw HTML is ever rendered.

---

## 10. Voice input (`lib/voice/*`)
1. Mic click → `POST /api/voice/token` → `ws = new WebSocket(`${NEXT_PUBLIC_WS_URL}/ws/voice?token=${token}`)`.
2. `navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })`.
3. `const ctx = new AudioContext({ sampleRate: 16000 })`; load `pcm-worklet.js` (AudioWorkletProcessor) that converts Float32 samples to Int16 little-endian and posts frames of exactly **512 samples** (1024 bytes).
4. On `ws.onopen`: send `{"type":"start","lang":<settings language or "AUTO">,"sampleRate":16000}`; wait for `ready`; then send each frame as binary.
5. `partial` → show grey text in the composer; `final` → append committed text; `error` → inline error next to the mic.
6. Stop click → send `{"type":"stop"}`, stop tracks, close the context; the server sends the last `final` and closes.
7. Errors: permission denied → "Allow microphone access"; `VOICE_BUSY` → "Voice is busy, try again in a moment"; feature off → mic hidden.
8. Read aloud (optional; only when `status.ai.features.tts` is true): a speaker button on assistant messages → `POST /api/voice/tts { text: <message text without Markdown, max 1000 chars>, lang }` → play the returned `audio/wav` with an `Audio` object from a `blob:` URL; `503 FEATURE_UNAVAILABLE` → hide the button.

---

## 11. Acceptance checklist
1. All API calls go through `/api/*` (Route Handler) and SSE streams arrive token by token (no buffering) in `next dev` and `next start`.
2. Expired access token → transparent refresh → request succeeds; refresh failure → login page with `next`. Reloading an app page 31+ minutes after login (only `session_hint` left) stays logged in.
3. Chat works with HOST, BROWSER and LOCAL_OLLAMA; the streamed text is replaced by the saved message on `done`/complete.
4. Stop works for all three; a stopped answer is saved and shown as "Stopped"; Stop before any text (or while the model loads) saves nothing and leaves the chat ready for the next message.
5. Web search approval card appears when "Ask before searching" is on; editing the query changes the search.
6. A model returning invalid JSON triggers the repair loop (visible "Fixing the format…") and ends in a valid plan/quiz or a clear failure message.
7. Markdown images never render; links only open in a new tab; `javascript:` links are inert.
8. Ollama connection test shows the right message for: Ollama off, origin not allowed, permission denied, no models, Safari.
9. WebGPU missing → browser option disabled with an explanation; a GPU without `shader-f16` (e.g. Firefox) automatically uses the q4f32 builds.
10. Grounding badges and unsupported-sentence underlines render from `meta.grounding`.
11. Model Test runs the Quick suite end to end and shows the scorecard; leaving the page doesn't stop the run.
