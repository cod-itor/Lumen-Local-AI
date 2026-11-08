# API_CONTRACT.md — The Public API (single source of truth)

> **Who reads this:** the frontend developer (to call the API) and the backend developer (to implement it).
> If another document disagrees with this file about a path, field, enum, status code or event name, **this file wins**.
> Internal APIs between the backend and the AI service are in `AI_SERVICE.md` §4, not here.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | Every endpoint starts with `/api`. The browser calls it on the same origin as the website (Next.js rewrites `/api/*` to the backend). |
| Format | JSON, UTF-8, `camelCase` field names. Streaming endpoints return `text/event-stream` (§5). |
| IDs | UUID strings (`"3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90"`). Eval case IDs and suite IDs are short strings. |
| Time | ISO-8601 in UTC with `Z` (`"2026-11-08T03:15:00Z"`). Dates without time: `"2026-11-08"`. |
| Enums | `UPPER_SNAKE_CASE` strings. Unknown enum values in requests → `400 VALIDATION_ERROR`. |
| Nulls | Optional fields may be omitted or `null`. The backend never returns `undefined` keys for required fields. |
| Pagination | Query `page` (0-based, default 0) and `size` (default 20, max 100). Response is `PageResponse<T>` (§4.1). |
| Auth | Cookie `access_token` (httpOnly). Swagger and tests may send `Authorization: Bearer <accessToken>` instead. |
| Ownership | Every resource belongs to one user. Accessing another user's resource returns `404 NOT_FOUND` (never 403, so IDs cannot be probed). |
| Idempotency | `DELETE` of a missing resource returns `404`. Repeated `POST .../complete` for a completed turn returns `409 TURN_ALREADY_COMPLETED`. |
| Text limits | All free-text inputs are trimmed. Empty after trimming = `400 VALIDATION_ERROR`. Limits are listed per field. |
| Versioning | No version in the path. Breaking changes require updating this file and both apps together. |

---

## 2. Authentication and cookies

| Cookie | Content | Attributes |
|---|---|---|
| `access_token` | JWT (HS256), lifetime 30 min | `HttpOnly; Path=/; SameSite=Lax; Secure` (Secure only when `PUBLIC_URL` is https) `; Max-Age=1800` |
| `refresh_token` | Random 256-bit opaque token (base64url), lifetime 14 days | `HttpOnly; Path=/api/auth; SameSite=Lax; Secure; Max-Age=1209600` |
| `session_hint` | The constant `1` (no secret) | `HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=1209600` — set and cleared together with `refresh_token` |

Rules:
1. Login, register and refresh set `access_token`, `refresh_token` and `session_hint`; login and register also return `accessToken` in the body (only for Swagger/testing; the frontend ignores it).
2. When any request returns `401 UNAUTHENTICATED`, the frontend calls `POST /api/auth/refresh` **once**, then retries the original request once. If refresh fails, it redirects to `/login?next=<current path>`.
3. Refresh tokens rotate on every refresh. If an already-used (rotated) refresh token is presented, the backend revokes **all** of that user's refresh tokens (token theft protection) and returns `401 REFRESH_REUSED`.
4. `session_hint` exists only so the Next.js proxy can tell "may still have a session" on page requests: `refresh_token` is scoped to `/api/auth` and is never sent with page requests. It grants nothing by itself.
5. CSRF: state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) must carry an `Origin` header equal to `PUBLIC_URL`; otherwise `403 FORBIDDEN_ORIGIN`. Browsers send `Origin` automatically. Requests with an `Authorization: Bearer` header and no cookie are exempt (Swagger, scripts).

---

## 3. Errors

### 3.1 Error body
Every non-2xx JSON response has this shape:
```json
{
  "timestamp": "2026-11-08T03:15:00Z",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "Password must be at least 8 characters.",
  "path": "/api/auth/register",
  "details": { "fields": { "password": "must be at least 8 characters" } }
}
```
`message` is safe to show to the user. `details` is optional and code-specific.

### 3.2 Error codes

| HTTP | `code` | When | `details` |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/query fails validation | `{ fields: { name: reason } }` |
| 400 | `GUARD_BLOCKED` | A non-chat text input (image prompt, learning goal) is blocked by guardrails (`action = BLOCK`) or needs the support message (`action = SUPPORT`, e.g. a self-harm goal) | `{ action: 'BLOCK' \| 'SUPPORT', category, refusal }` — `refusal` is the text to show (support text for SUPPORT; show it in the calm support style, not as an error) |
| 401 | `UNAUTHENTICATED` | Missing/expired access token | — |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (same message for both) | — |
| 401 | `REFRESH_INVALID` | Missing/expired/unknown refresh token | — |
| 401 | `REFRESH_REUSED` | A rotated refresh token was reused; all sessions revoked | — |
| 403 | `FORBIDDEN` | Role not allowed (e.g. admin endpoints) | — |
| 403 | `FORBIDDEN_ORIGIN` | CSRF origin check failed | — |
| 404 | `NOT_FOUND` | Resource missing or not owned by the caller | `{ resource }` |
| 404 | `TURN_NOT_FOUND` | Unknown turn or not owned | — |
| 409 | `EMAIL_TAKEN` | Register with an existing email | — |
| 409 | `CONFLICT` | Generic state conflict (e.g. learning path in the wrong state; another turn for the same chat, learning path or Model Test run is still open) | `{ currentState }` |
| 409 | `TURN_NOT_READY` | `complete` called on a turn that is not `READY` | `{ status }` |
| 409 | `TURN_ALREADY_COMPLETED` | Turn already finished | `{ status }` |
| 409 | `CANNOT_DELETE_HOST` | Deleting the HOST provider | — |
| 410 | `TURN_EXPIRED` | Turn older than its `expiresAt` | — |
| 413 | `PAYLOAD_TOO_LARGE` | Upload or completion over the limit | `{ maxBytes }` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Upload type not allowed | `{ allowed: [...] }` |
| 422 | `SCHEMA_INVALID` | The model output of a turn was invalid (JSON schema/semantic checks, missing lesson heading) or empty, and another attempt is allowed | `{ reason: 'INVALID' \| 'EMPTY', errors: [...], attemptsLeft, repairMessages }` (§6.4) |
| 422 | `RULES_INVALID` | `POST /api/admin/reload-rules`: the new rules failed validation; the old rules stay active | `{ errors: [...] }` |
| 422 | `URL_NOT_ALLOWED` | A REMOTE_URL provider address fails the safety check | `{ reason }` |
| 429 | `RATE_LIMITED` | Too many requests (also sets `Retry-After` header) | `{ retryAfterSeconds }` |
| 429 | `QUOTA_EXCEEDED` | Daily/storage quota reached | `{ quota, limit }` |
| 503 | `FEATURE_UNAVAILABLE` | Host-only feature while the host has no such model (e.g. image generation in `lite`) | `{ feature }` |
| 503 | `AI_SERVICE_UNAVAILABLE` | Backend cannot reach the AI service | — |
| 503 | `PROVIDER_UNAVAILABLE` | HOST/REMOTE_URL provider cannot generate right now | `{ providerKind }` |
| 504 | `AI_TIMEOUT` | AI service did not answer in time | — |
| 500 | `INTERNAL_ERROR` | Anything unexpected (logged with a correlation id) | `{ correlationId }` |

Codes that only appear inside a turn stream (`error` event) or as a turn's `errorCode`:
| `code` | When | `retryable` |
|---|---|---|
| `CONTEXT_TOO_SMALL` | The model's context window cannot fit this task's prompt even after dropping the Example and shortening the user text (HARNESS.md §7.2) | false |
| `PROVIDER_ERROR` | The visitor's browser or Ollama model failed (reported by the browser through `POST /cancel` with `reason = CLIENT_ERROR`) | true |
| `SCHEMA_INVALID`, `EMPTY_OUTPUT` | `errorCode` of a turn that ended `FAILED` because every attempt was invalid / empty | true |
| `STREAM_INTERRUPTED` | Client-side only: the stream closed without a terminal event (§5) | true |
| `AI_SERVICE_UNAVAILABLE`, `AI_TIMEOUT`, `PROVIDER_UNAVAILABLE` | As in the table above, but after the stream started | true |
| `INTERNAL_ERROR` | As in the table above, but after the stream started | false |

### 3.3 Rate limits (per user unless stated)

| Endpoint group | Limit |
|---|---|
| `POST /api/auth/login` | 10 / minute per IP and 20 / hour per email |
| `POST /api/auth/register` | 5 / hour per IP |
| `POST /api/harness/turns` | 20 / minute and 400 / day |
| `POST /api/harness/turns/{id}/complete` | 40 / minute |
| `POST /api/documents` | 20 / hour; total storage 500 MB per user (`QUOTA_EXCEEDED`) |
| `POST /api/images/generate` and `/variations` | 10 / hour |
| `POST /api/messages/{id}/translate` | 60 / hour |
| `POST /api/voice/token` | 30 / hour |
| `POST /api/evals/runs` | 10 / day |

---

## 4. Shared types (TypeScript notation)

These are the exact JSON shapes. The frontend copies them into `src/types/api.ts`; the backend implements them as DTO records.

### 4.1 Common
```ts
type UUID = string;
type Instant = string; // ISO-8601 UTC

interface PageResponse<T> {
  items: T[];
  page: number;        // 0-based
  size: number;
  totalItems: number;
  totalPages: number;
}
```

### 4.2 Enums
```ts
type Role = 'USER' | 'ADMIN';
type Theme = 'LIGHT' | 'DARK' | 'SYSTEM';
type UiLanguage = 'EN' | 'KM';
type OutputLanguage = 'EN' | 'KM' | 'BOTH';
type InputLanguage = 'EN' | 'KM' | 'MIXED' | 'OTHER';
type AnswerLength = 'SHORT' | 'NORMAL' | 'DETAILED';
type GuardProfile = 'STANDARD' | 'STRICT' | 'TEST';           // TEST is only used by Model Test runs
type Tab = 'CHAT' | 'DOCS';
type MessageRole = 'USER' | 'ASSISTANT';
type MessageStatus = 'COMPLETE' | 'STOPPED' | 'BLOCKED' | 'ABSTAINED';   // a failed turn saves no assistant message (§6.4 rule 5)
type ProviderKind = 'HOST' | 'BROWSER' | 'LOCAL_OLLAMA' | 'REMOTE_URL';
type GenerationSide = 'SERVER' | 'CLIENT';
type Task =
  | 'MESSAGE'          // a chat or documents message (the router picks CHAT, RAG or WEB)
  | 'TITLE'            // chat title
  | 'IMAGE_CLARIFY'    // questions for a vague image request
  | 'IMAGE_PROMPT'     // rewritten image prompt for approval
  | 'LEARN_QUESTION'   // next interview question for a learning path
  | 'LEARN_PLAN'       // learning plan
  | 'LEARN_STEP'       // lesson content for one step
  | 'QUIZ'             // quiz for one step
  | 'EVAL_CASE';       // one Model Test case
type Pipeline = 'CHAT' | 'RAG' | 'WEB';
type TurnStatus =
  | 'PREPARING' | 'AWAITING_APPROVAL' | 'READY' | 'GENERATING' | 'FINALIZING'
  | 'COMPLETED' | 'BLOCKED' | 'ABSTAINED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
type TurnStage =
  | 'CHECKING_INPUT' | 'TRANSLATING_INPUT' | 'ROUTING' | 'RETRIEVING' | 'SEARCHING' | 'READING'
  | 'BUILDING_PROMPT' | 'QUEUED' | 'GENERATING' | 'CHECKING_OUTPUT' | 'VERIFYING_SOURCES'
  | 'TRANSLATING_OUTPUT' | 'SAVING';
type FinishReason = 'STOP' | 'LENGTH' | 'ABORTED' | 'GUARD_STOP' | 'LOOP_STOP';   // a failed generation is reported with `cancel` (CLIENT_ERROR) or an `error` event, never as a finish reason
type GroundingLevel = 'GROUNDED' | 'PARTIAL' | 'UNGROUNDED' | 'ABSTAINED' | 'NOT_APPLICABLE';
type SentenceIssue = 'NO_CITATION' | 'INVALID_CITATION' | 'LOW_SUPPORT' | 'NUMBER_NOT_IN_SOURCE' | 'QUOTE_NOT_IN_SOURCE';
type GuardAction = 'ALLOW' | 'FLAG' | 'SAFE_COMPLETE' | 'SUPPORT' | 'REPLACE' | 'BLOCK';
type SuggestionType =
  | 'TURN_ON_WEB_SEARCH' | 'VERIFY_WITH_WEB_SEARCH' | 'OPEN_IMAGE_TAB' | 'START_LEARNING_PATH'
  | 'UPLOAD_DOCUMENT' | 'ASK_MY_DOCUMENTS' | 'SWITCH_TO_HOST_MODEL';
type DocumentStatus = 'UPLOADED' | 'PARSING' | 'EMBEDDING' | 'READY' | 'FAILED';
type JobType = 'INGEST' | 'IMAGE' | 'VARIATION' | 'BG_REMOVAL';
type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
type ImageKind = 'GENERATED' | 'BG_REMOVED' | 'VARIATION';
type AspectRatio = 'SQUARE' | 'PORTRAIT' | 'LANDSCAPE' | 'WIDE';   // 1024x1024, 832x1216, 1216x832, 1344x768
type LearningPathState = 'INTERVIEWING' | 'PLANNING' | 'AWAITING_APPROVAL' | 'ACTIVE' | 'COMPLETED';
type LearningNextAction = 'ASK' | 'PLAN' | 'APPROVE' | 'STUDY' | 'NONE';
type StepStatus = 'LOCKED' | 'CURRENT' | 'DONE';
type ContentStatus = 'EMPTY' | 'READY' | 'FAILED';
type EvalMode = 'QUICK' | 'FULL';
type EvalRunStatus = 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
type EvalCategory =
  | 'SAFETY' | 'INJECTION' | 'RAG_FAITHFULNESS' | 'RAG_ABSTAIN' | 'KNOWLEDGE_HUMILITY'
  | 'TOOL_USE' | 'INSTRUCTION' | 'JSON' | 'KHMER';
type ProviderStatus = 'UNTESTED' | 'OK' | 'FAILED';
```

### 4.3 Users and settings
```ts
interface UserDto { id: UUID; name: string; email: string; role: Role; createdAt: Instant; }

interface SettingsDto {
  theme: Theme;                     // default SYSTEM
  uiLanguage: UiLanguage;           // default EN
  outputLanguage: OutputLanguage;   // default EN
  answerLength: AnswerLength;       // default NORMAL
  temperature: number | null;       // 0.0–1.0; null = mode default. Applies to the CHAT pipeline only.
  askBeforeSearch: boolean;         // default false
  guardProfile: 'STANDARD' | 'STRICT'; // default STANDARD
  timezone: string;                 // IANA name, default "Asia/Phnom_Penh"; the frontend sends the browser's zone on first login
  showSpeedStats: boolean;          // default true
  defaultProviderId: UUID | null;   // not stored in settings: the provider with isDefault = true (§6.2)
}

interface AuthResponse { user: UserDto; settings: SettingsDto; accessToken: string; accessTokenExpiresAt: Instant; }
interface MeResponse { user: UserDto; settings: SettingsDto; }
```

### 4.4 Chats and messages
```ts
interface ChatDto {
  id: UUID;
  tab: Tab;
  title: string;                    // never empty; "New chat" until the first message
  titleSource: 'DEFAULT' | 'AUTO' | 'AI' | 'USER';
  documentIds: UUID[];              // DOCS tab: documents this chat may search
  activeLeafId: UUID | null;        // last message of the currently shown branch
  lastMessagePreview: string | null;// first 120 chars of the last message on the active branch
  createdAt: Instant;
  updatedAt: Instant;
}

interface SourceDto {
  n: number;                        // citation number shown as [n], 1-based, unique within one message
  kind: 'DOC' | 'WEB';
  title: string;                    // document filename or page title
  documentId?: UUID;                // DOC
  chunkId?: UUID;                   // DOC (and WEB when cached)
  page?: number;                    // DOC, 1-based, when known
  url?: string;                     // WEB
  siteName?: string;                // WEB, e.g. "example.org"
  publishedAt?: string;             // WEB, as given by the page if known
  snippet: string;                  // ≤ 300 chars shown on the source card
  score: number;                    // retrieval similarity 0–1 (for display/debug)
}

interface SentenceReport {
  index: number;                    // sentence order in the answer
  start: number; end: number;       // UTF-16 code-unit offsets (JS string indexes) into the model-language text:
                                    // `originalContent` when it is non-null (translated answers), else `content`
  citations: number[];              // [n] values found in the sentence
  supported: boolean;
  issue?: SentenceIssue;
}

interface GroundingReport {
  level: GroundingLevel;
  supportedRatio: number;           // supported factual sentences / factual sentences (0–1)
  sentences: SentenceReport[];      // only for RAG/WEB answers
  removedUrls: number;              // URLs removed by the link policy
  removedCitations: number;         // invalid [n] removed
  hasSpecificFacts: boolean;        // CHAT answers: contains numbers/dates/names that were not checked
}

interface ToolResultDto { tool: 'CALCULATOR' | 'DATETIME'; input: string; output: string; }

interface SuggestionDto { type: SuggestionType; label: string; payload?: Record<string, string>; }

interface GuardSummary { action: GuardAction; categories: string[]; profile: GuardProfile; }

interface GenerationStats { ttftMs: number | null; tokensPerSec: number | null; outputTokens: number | null; promptTokens: number | null; totalMs: number | null; }

interface MessageMeta {
  task: Task;
  pipeline: Pipeline | null;
  providerKind: ProviderKind | null;     // null for user messages
  model: string | null;
  outputLanguage: OutputLanguage;
  inputLanguage: InputLanguage | null;   // user messages
  sources: SourceDto[];
  grounding: GroundingReport | null;
  guard: GuardSummary | null;
  tools: ToolResultDto[];
  suggestions: SuggestionDto[];
  stats: GenerationStats | null;
  finishReason: FinishReason | null;
  feedback: { rating: 1 | -1; reason: string | null } | null;
}

interface MessageDto {
  id: UUID;
  chatId: UUID;
  parentId: UUID | null;            // previous message on the branch
  role: MessageRole;
  content: string;                  // text to display by default (already in the chosen output language)
  originalContent: string | null;   // the model's raw language (English) if `content` is a translation
  translations: { EN?: string; KM?: string };   // extra translations made on request or for BOTH
  status: MessageStatus;
  meta: MessageMeta;
  createdAt: Instant;
}

interface ChatMessagesResponse { chatId: UUID; activeLeafId: UUID | null; messages: MessageDto[]; }
```

**Branching rule.** Messages form a tree through `parentId`. The visible conversation is the path from the root to `activeLeafId`. Siblings are messages with the same `parentId` and role; the UI shows them as versions (`< 2 / 3 >`). Switching versions = `PATCH /api/chats/{id}` with the deepest message of the chosen branch as `activeLeafId` (the frontend computes it by following the newest child repeatedly).

**Language rule.** For `outputLanguage = KM`, `content` is the Khmer translation and `originalContent` holds the English the model wrote. For `BOTH`, `content` is English and `translations.KM` is Khmer; the UI shows both side by side. For `EN`, `originalContent` is null.

### 4.5 Providers and model profiles
```ts
interface ModelProfile {
  family: string;                   // e.g. "gemma", "qwen3", "llama3.2", "default"
  contextWindow: number;            // tokens to plan for (num_ctx for Ollama)
  systemRole: boolean;              // false → client merges the system message into the first user message
  jsonSchema: boolean;              // supports schema-constrained output
  thinking: 'NONE' | 'TAGS' | 'FIELD';     // how reasoning text appears
  disableThinking: 'NONE' | 'OLLAMA_THINK_FALSE' | 'NO_THINK_SUFFIX' | 'WEBLLM_EXTRA_BODY';
  khmerNative: boolean;             // true → the model writes Khmer itself (no translation pivot)
  maxOutputTokens: number;          // hard cap
  topP: number;                     // default 0.9
  repeatPenalty: number;            // default 1.1 (RAG/WEB use rules/harness.yaml generation.repeatPenaltyGrounded)
  tokenFactor: number;              // multiplies the token estimate (HARNESS.md §7.1), default 1.0
}

interface ProviderDto {
  id: UUID;
  name: string;
  kind: ProviderKind;
  generation: GenerationSide;       // HOST/REMOTE_URL → SERVER; BROWSER/LOCAL_OLLAMA → CLIENT
  baseUrl: string | null;           // LOCAL_OLLAMA default "http://localhost:11434"; REMOTE_URL https only
  model: string;                    // Ollama tag or WebLLM model id
  hasApiKey: boolean;               // REMOTE_URL only; the key is never returned
  isDefault: boolean;
  status: ProviderStatus;
  lastTestedAt: Instant | null;
  lastTestMessage: string | null;
  modelProfile: ModelProfile;       // resolved from rules/models.yaml (+ test results)
  features: { chat: boolean; documents: boolean; webSearch: boolean; learning: boolean; images: boolean };
  createdAt: Instant;
}

interface BrowserModelDto {
  id: string;                       // WebLLM model id, e.g. "Qwen3.5-2B-q4f16_1-MLC"
  fallbackId: string;               // q4f32_1 build; used whenever the GPU lacks the WebGPU "shader-f16" feature (every q4f16 build needs it)
  label: string;                    // e.g. "Qwen 3.5 · 2B (recommended)"
  vramMb: number;                   // GPU memory needed (WebLLM vram_required_MB)
  fallbackVramMb: number;
  recommended: boolean;
}

interface ProviderCatalogDto {
  host: { available: boolean; models: string[] };
  browser: { models: BrowserModelDto[] };
  ollamaSuggestions: { tag: string; label: string; sizeGb: number; note: string }[];
}
```

### 4.6 Harness (turn protocol)
```ts
interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

interface GenParams {
  temperature: number;
  topP: number;
  maxTokens: number;                // output token cap
  stop: string[];
  repeatPenalty: number;            // Ollama options.repeat_penalty; WebLLM repetition_penalty
  minP: number | null;              // Ollama options.min_p (ignored by WebLLM)
  seed: number | null;
  numCtx: number;                   // context window to request (Ollama options.num_ctx)
}

interface ClientGuardConfig {
  stopPatterns: string[];           // JS regex sources, flags "iu"; stop generation if the accumulated text matches
  maxOutputChars: number;
  loop: LoopConfig;                 // HARNESS.md §8.4; values from rules/harness.yaml → loopDetection
}
interface LoopConfig {
  windowChars: number; minRepeatLen: number; maxRepeatLen: number; repeatLenStep: number;
  maxRepeats: number; checkEveryChars: number; sameLineRepeats: number; sameLineMinChars: number;
}

interface HarnessTurnRequest {
  task: Task;
  providerId: UUID;
  // MESSAGE
  chatId?: UUID;
  content?: string;                 // 1–4000 chars; required for MESSAGE unless regenerateOf or answerOf is set
  parentId?: UUID;                  // defaults to chat.activeLeafId
  regenerateOf?: UUID;              // assistant message to regenerate (content must be absent)
  editOf?: UUID;                    // user message being edited (creates a sibling user message)
  answerOf?: UUID;                  // existing user message that has no answer yet (Retry); content must be absent
  webSearch?: boolean;              // CHAT tab only
  outputLanguage?: OutputLanguage;  // defaults to settings.outputLanguage
  // other tasks
  target?: { type: 'CHAT' | 'IMAGE_SESSION' | 'LEARNING_PATH' | 'LEARNING_STEP' | 'EVAL_RUN'; id: UUID };
  taskInput?: Record<string, unknown>; // per task, see §6.4
}

interface TurnStartedEvent { turnId: UUID; task: Task; generation: GenerationSide; userMessage: MessageDto | null; expiresAt: Instant; }
// userMessage (MESSAGE only) = the user message being answered: newly saved for `content`/`editOf`, the existing one for `regenerateOf`/`answerOf`
interface RetryEvent { attempt: number; reason: 'INVALID' | 'EMPTY'; }   // SERVER generation starts another attempt: discard the streamed text
interface StatusEvent { stage: TurnStage; detail?: string; }
interface ApprovalEvent { turnId: UUID; kind: 'SEARCH_QUERY'; content: string; }
interface BlockedEvent { action: 'BLOCK' | 'SUPPORT'; message: MessageDto | null; refusal: string; categories: string[]; }
interface AbstainedEvent { message: MessageDto; }
interface PreparedEvent {
  turnId: UUID;
  messages: ChatMessage[];
  params: GenParams;
  outputSchema: object | null;      // JSON Schema for structured tasks
  modelProfile: ModelProfile;
  clientGuard: ClientGuardConfig;
  attempt: number;                  // 1-based
}
interface TokenEvent { text: string; }
interface TurnResult {
  turnId: UUID;
  task: Task;
  status: 'COMPLETED' | 'BLOCKED' | 'ABSTAINED' | 'CANCELLED' | 'FAILED';  // = the turn's final status (§6.4 "Turn outcomes")
  message: MessageDto | null;       // MESSAGE: the saved assistant message (COMPLETE, STOPPED, BLOCKED or ABSTAINED); null when CANCELLED/FAILED
  data: unknown | null;             // other tasks when COMPLETED, see §6.4; otherwise null
  notice: string | null;            // user-facing text when status is BLOCKED/FAILED for non-MESSAGE tasks, or FAILED for MESSAGE
  guardAction: 'BLOCK' | 'REPLACE' | 'SUPPORT' | null;   // set when status is BLOCKED; SUPPORT → show `notice`/`message` in the calm support style
}
interface ErrorEvent { code: string; message: string; retryable: boolean; }

interface CompleteTurnRequest {
  content: string;                  // ≤ 32 KB UTF-8; raw model output (the server strips reasoning again)
  finishReason: FinishReason;
  stats: GenerationStats & { model: string };
  attempt: number;                  // must equal the attempt the server expects
}

interface TurnDto { id: UUID; task: Task; status: TurnStatus; generation: GenerationSide; attempt: number; errorCode: string | null; createdAt: Instant; expiresAt: Instant; resultMessageId: UUID | null; }
interface CancelTurnRequest { reason?: 'USER' | 'CLIENT_ERROR'; errorCode?: string; }   // body optional; default USER
interface CancelTurnResponse { turnId: UUID; status: TurnStatus; }   // CANCELLED or FAILED at once, or FINALIZING (a partial answer is being saved)
```

### 4.7 Documents and jobs
```ts
interface DocumentDto {
  id: UUID; filename: string; mime: string; sizeBytes: number; pages: number | null;
  status: DocumentStatus; error: string | null; chunkCount: number; language: InputLanguage | null;
  createdAt: Instant;
}
interface UploadResponse { document: DocumentDto; jobId: UUID | null; duplicate: boolean; } // duplicate = same file already READY in the library → no new job (jobId null)
interface ChunkDto { chunkId: UUID; documentId: UUID; page: number | null; startChar: number; endChar: number; text: string; }
interface DocumentTextDto { documentId: UUID; page: number | null; text: string; totalPages: number | null; }

interface JobDto {
  id: UUID; type: JobType; status: JobStatus; progress: number; // 0–1
  stage: string | null; result: unknown | null; error: string | null;
  createdAt: Instant; updatedAt: Instant;
}
```

### 4.8 Images
```ts
interface ImageSessionDto { id: UUID; title: string; coverImageId: UUID | null; createdAt: Instant; updatedAt: Instant; }
interface ImageDto {
  id: UUID; sessionId: UUID; parentId: UUID | null; kind: ImageKind;
  prompt: string; originalPrompt: string | null;
  url: string;                      // "/api/files/images/{id}"
  width: number; height: number;
  meta: { model: string; seed: number; steps: number; aspectRatio: AspectRatio; durationMs: number };
  createdAt: Instant;
}
interface ImageClarifyResult { questions: { id: string; question: string; options: string[] }[]; }
interface ImagePromptResult { prompt: string; originalPrompt: string; originalPromptEnglish: string; } // originalPromptEnglish = the request after pivot translation ("Use my original" sends this as `prompt`; the image model needs English)
interface GenerateImagesRequest {
  sessionId: UUID; prompt: string;  // approved prompt, 1–1000 chars
  originalPrompt?: string;          // what the user typed
  aspectRatio: AspectRatio; count: 1 | 2 | 3 | 4; seed?: number | null; steps?: number | null; // 1–8, default 4 (FLUX.2 klein is a 4-step distilled model)
}
```

### 4.9 Learning
```ts
interface InterviewItem { topic: 'level' | 'outcome' | 'time' | 'focus' | 'style'; question: string; options: string[]; answer: string | null; }
interface PlanStepDto { title: string; summary: string; objectives: string[]; }
interface PlanDto { title: string; level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'; steps: PlanStepDto[]; }
interface LearningStepDto {
  id: UUID; position: number;       // 1-based
  title: string; summary: string; objectives: string[];
  content: string | null; contentStatus: ContentStatus;
  status: StepStatus; bestScore: number | null; // 0–1
}
interface LearningPathDto {
  id: UUID; goal: string; state: LearningPathState; nextAction: LearningNextAction;
  interview: InterviewItem[];       // the last item may have answer = null (pending question)
  plan: PlanDto | null;
  steps: LearningStepDto[];
  progress: { done: number; total: number };
  createdAt: Instant; updatedAt: Instant;
}
interface QuizDto { id: UUID; stepId: UUID; questions: { index: number; question: string; options: string[] }[]; createdAt: Instant; }
interface QuizResultDto {
  quizId: UUID; score: number; passed: boolean; // passed = score ≥ 0.7
  results: { index: number; selected: number | null; correctIndex: number; correct: boolean; explanation: string; evidence: string }[];
  step: LearningStepDto; nextStep: LearningStepDto | null;
}
```

### 4.10 Model Test (evals)
```ts
interface EvalSuiteDto { id: string; version: number; quickCount: number; fullCount: number; categories: EvalCategory[]; }
interface EvalCheckDto { name: string; passed: boolean; detail: string | null; }
interface EvalResultDto {
  caseId: string; category: EvalCategory; passed: boolean; checks: EvalCheckDto[];
  output: string; guardWouldBlock: boolean; stats: GenerationStats | null;
  error: string | null;             // set when the case could not be run (e.g. PROVIDER_ERROR, TURN_EXPIRED); counts as failed
  createdAt: Instant;
}
interface CategoryScore { passed: number; total: number; score: number; }
interface EvalRunDto {
  id: UUID; providerId: UUID; providerKind: ProviderKind; model: string; suite: string; mode: EvalMode;
  status: EvalRunStatus; caseIds: string[]; completedCases: number;
  score: number | null;                         // weighted, 0–1
  categoryScores: Partial<Record<EvalCategory, CategoryScore>>;
  safetyWithGuardrails: number | null;          // SAFETY+INJECTION pass rate when guardrail decisions count
  speed: { avgTtftMs: number | null; avgTokensPerSec: number | null };
  createdAt: Instant; finishedAt: Instant | null;
}
interface EvalRunDetailDto extends EvalRunDto { results: EvalResultDto[]; }
```

### 4.11 System and admin
```ts
interface SystemStatusDto {
  backend: { version: string };
  ai: {
    reachable: boolean; profile: 'lite' | 'full' | null;
    features: { hostChat: boolean; images: boolean; bgRemoval: boolean; voice: boolean; tts: boolean; translation: boolean; webSearch: boolean; guardClassifier: boolean };
    loadedModels: { name: string; sizeMb: number }[];
    queue: { heavyJobsQueued: number; heavyJobRunning: boolean };
  };
}
interface GuardEventDto { id: UUID; userId: UUID; stage: 'INPUT' | 'OUTPUT'; action: GuardAction; categories: string[]; rule: string; excerpt: string; providerKind: ProviderKind | null; model: string | null; profile: GuardProfile; createdAt: Instant; }
```

---

## 5. Server-Sent Events (SSE)

Used by: `POST /api/harness/turns`, `POST /api/harness/turns/{id}/approval`, `GET /api/jobs/{id}/events`.

Wire format (one event):
```
event: status
data: {"stage":"RETRIEVING"}

```
- `data` is always **one line** of JSON.
- Heartbeat: a comment line `: ping` every 15 seconds while the stream is open.
- The server **closes the stream after a terminal event**. Terminal events: `approval`, `blocked`, `abstained`, `prepared`, `done`, `cancelled`, `error`.
- If the stream closes without a terminal event, the client treats it as `STREAM_INTERRUPTED`: it calls `GET /api/harness/turns/{turnId}`; if the turn is terminal (`COMPLETED`, `BLOCKED`, `ABSTAINED`, `CANCELLED`, `EXPIRED`, `FAILED`) it reloads the chat messages (or the task's target), otherwise it shows "Connection lost" with a Retry button.
- Response headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `Connection: keep-alive`.
- The client uses `fetch` + a stream reader (not `EventSource`, because these are `POST` requests).

### 5.1 Harness turn events

| Event | Data | Terminal | Meaning |
|---|---|---|---|
| `turn` | `TurnStartedEvent` | no | Always first. For MESSAGE it includes the saved user message. |
| `status` | `StatusEvent` | no | Progress for the UI (search steps, "Checking sources…"). `QUEUED` while a SERVER generation waits for a free slot; `detail` = the queue position as a string, e.g. `"2"`. |
| `sources` | `SourceDto[]` | no | Sources that the answer may cite (RAG/WEB). Sent before generation. |
| `tools` | `ToolResultDto[]` | no | Calculator/date results computed by code. |
| `approval` | `ApprovalEvent` | **yes** | Ask the user to approve/edit the web search query, then call `/approval`. |
| `blocked` | `BlockedEvent` | **yes** | Input guardrail blocked the request; for MESSAGE a refusal message is saved. |
| `abstained` | `AbstainedEvent` | **yes** | No relevant documents/results; the app answered "couldn't find" without calling the model. |
| `prepared` | `PreparedEvent` | **yes** | CLIENT generation: the browser must now generate and call `/complete`. |
| `token` | `TokenEvent` | no | SERVER generation: next piece of text (reasoning already removed). |
| `retry` | `RetryEvent` | no | SERVER generation: the previous attempt was invalid or empty and attempt N starts now. Clear the streamed text and show "Fixing the format…" (INVALID) or "Trying again…" (EMPTY). |
| `done` | `TurnResult` | **yes** | Final result of a SERVER generation: status COMPLETED, BLOCKED or ABSTAINED from the output pipeline, or FAILED when no valid output came after all attempts. Replace the streamed text with `message.content`. |
| `cancelled` | `{ turnId }` | **yes** | The turn ended `CANCELLED` (§6.4 `cancel`, or a Stop before any text) and nothing was saved. |
| `error` | `ErrorEvent` | **yes** | Failed. `retryable` tells the UI whether to show Retry. |

### 5.2 Job events (`GET /api/jobs/{id}/events`)

| Event | Data | Terminal |
|---|---|---|
| `progress` | `{ progress: number; stage: string; detail?: string }` | no |
| `done` | `JobDto` | yes |
| `error` | `ErrorEvent` | yes |

If the job is already finished when the client connects, the server sends `done` (or `error`) immediately.

Job `error.code` values (show `message`; it is already user-facing):
| Job type | Codes |
|---|---|
| `INGEST` | `SCANNED_PDF` (no selectable text; OCR not supported), `EMPTY_DOCUMENT`, `TOO_MANY_PAGES` (> 300), `PARSE_FAILED`, `EMBED_FAILED` |
| `IMAGE`, `VARIATION`, `BG_REMOVAL` | `GUARD_BLOCKED`, `FEATURE_UNAVAILABLE` |
| any | `AI_SERVICE_UNAVAILABLE`, `AI_TIMEOUT`, `INTERNAL_ERROR` (`retryable: true` for the first two) |
A failed INGEST job also sets the document's `status = FAILED` and `error = message`; a cancelled INGEST job sets `status = FAILED` and `error = "Upload cancelled."`.

---

## 6. Endpoints

Legend: **Auth** = requires login. All request bodies are JSON unless stated.

### 6.1 Auth (`AuthController`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | — | `{ name, email, password }` | `201 AuthResponse` + cookies | 400, 409 `EMAIL_TAKEN`, 429 |
| POST | `/api/auth/login` | — | `{ email, password }` | `200 AuthResponse` + cookies | 400, 401 `INVALID_CREDENTIALS`, 429 |
| POST | `/api/auth/refresh` | refresh cookie | — | `200 AuthResponse` + new cookies | 401 `REFRESH_INVALID` / `REFRESH_REUSED` |
| POST | `/api/auth/logout` | — | — | `204` (revokes the refresh token, clears `access_token`, `refresh_token` and `session_hint`) | — |
| GET | `/api/auth/me` | Auth | — | `200 MeResponse` | 401 |
| DELETE | `/api/users/me` | Auth | `{ password }` | `204` (deletes the account, all its data and files; clears cookies) | 401 `INVALID_CREDENTIALS` |

Validation: `name` 1–60 chars; `email` valid, ≤ 254 chars, stored lower-case; `password` 8–72 chars with at least one letter and one digit. New users get default settings (§4.3) with `timezone` from the optional header `X-Timezone` if valid.

### 6.2 Settings (`SettingsController`)

| Method | Path | Auth | Request | Success |
|---|---|---|---|---|
| GET | `/api/settings` | Auth | — | `200 SettingsDto` |
| PATCH | `/api/settings` | Auth | Partial `SettingsDto` (any subset of fields) | `200 SettingsDto` |

Validation: `temperature` null or 0.0–1.0; `timezone` must be a valid IANA zone; `defaultProviderId` must be one of the user's providers (null is rejected). `defaultProviderId` has no column of its own: GET returns the id of the user's provider with `isDefault = true` (or null if there is none), and PATCH with an id does exactly what `POST /api/providers/{id}/default` does.

### 6.3 Chats and messages (`ChatController`, `MessageController`)

| Method | Path | Auth | Request | Success | Notes |
|---|---|---|---|---|---|
| GET | `/api/chats?tab=CHAT&q=&page=&size=` | Auth | — | `200 PageResponse<ChatDto>` | Sorted by `updatedAt` desc. `q` = case-insensitive title search. |
| POST | `/api/chats` | Auth | `{ tab, title?, documentIds? }` | `201 ChatDto` | `title` ≤ 80 chars; `documentIds` must be READY documents of the user. |
| GET | `/api/chats/{id}` | Auth | — | `200 ChatDto` | |
| PATCH | `/api/chats/{id}` | Auth | `{ title?, documentIds?, activeLeafId? }` | `200 ChatDto` | Setting `title` sets `titleSource = USER`. `activeLeafId` must be a message of this chat. |
| DELETE | `/api/chats/{id}` | Auth | — | `204` | Deletes messages and turns of the chat. |
| GET | `/api/chats/{id}/messages` | Auth | — | `200 ChatMessagesResponse` | All messages of the chat (max 1000), ordered by `createdAt`. |
| POST | `/api/messages/{id}/translate` | Auth | `{ target: 'EN' \| 'KM' }` | `200 { messageId, target, text }` | Cached in `translations`; repeated calls return the cache. |
| POST | `/api/messages/{id}/feedback` | Auth | `{ rating: 1 \| -1, reason?: string }` | `204` | `reason` ≤ 500 chars. Overwrites earlier feedback. |

**Sending, regenerating and editing messages all go through the harness (§6.4).** There is no separate "send message" endpoint.

### 6.4 Harness turns (`HarnessController`)

| Method | Path | Auth | Request | Success |
|---|---|---|---|---|
| POST | `/api/harness/turns` | Auth | `HarnessTurnRequest` | `200 text/event-stream` (§5.1) |
| POST | `/api/harness/turns/{id}/approval` | Auth | `{ decision: 'APPROVE' \| 'EDIT', content?: string }` | `200 text/event-stream` (continues from `SEARCHING`) |
| POST | `/api/harness/turns/{id}/complete` | Auth | `CompleteTurnRequest` | `200 TurnResult` |
| POST | `/api/harness/turns/{id}/cancel` | Auth | optional `CancelTurnRequest` | `200 CancelTurnResponse` — `CANCELLED`/`FAILED` immediately, or `FINALIZING` when a partial MESSAGE answer is being saved (the open stream then delivers `done`) |
| GET | `/api/harness/turns/{id}` | Auth | — | `200 TurnDto` |

Errors before the stream starts are normal JSON errors (400/404/409/429/503). Once the stream has started, errors arrive as an `error` event.

#### Per-task request rules

| Task | Required fields | `taskInput` | `target` | `done.data` / result |
|---|---|---|---|---|
| `MESSAGE` | `chatId`, and exactly one of `content`, `regenerateOf`, `answerOf` (`editOf` requires `content`) | — | — | `message: MessageDto` |
| `TITLE` | — | — | `{ type: CHAT, id }` | `{ title: string \| null }` (a usable title is also saved on the chat, `titleSource = AI`; null = the AUTO title stays) |
| `IMAGE_CLARIFY` | — | `{ request: string (1–500) }` | `{ type: IMAGE_SESSION, id }` | `ImageClarifyResult` |
| `IMAGE_PROMPT` | — | `{ request: string, answers: Record<string,string>, style?: string }` | `{ type: IMAGE_SESSION, id }` | `ImagePromptResult` |
| `LEARN_QUESTION` | — | — | `{ type: LEARNING_PATH, id }` (state INTERVIEWING) | `LearningPathDto` (with a new pending question, or `nextAction = PLAN`) |
| `LEARN_PLAN` | — | — | `{ type: LEARNING_PATH, id }` (state PLANNING) | `LearningPathDto` (state AWAITING_APPROVAL) |
| `LEARN_STEP` | — | — | `{ type: LEARNING_STEP, id }` (step not LOCKED, content `EMPTY` or `FAILED`) | `LearningStepDto` (content READY) |
| `QUIZ` | — | `{ count?: 3 \| 4 \| 5 }` (default 5) | `{ type: LEARNING_STEP, id }` (content READY) | `QuizDto` |
| `EVAL_CASE` | — | `{ caseId: string }` (a case of the run with no result yet, or only an error result) | `{ type: EVAL_RUN, id }` (run RUNNING) | `EvalResultDto` |

Rules:
1. `MESSAGE` with `regenerateOf`: creates a new assistant message as a sibling of the regenerated one (same parent user message). No new user message.
2. `MESSAGE` with `editOf`: saves a new user message as a sibling of `editOf` (same parent) with the new `content`, then answers it.
3. `webSearch: true` is only allowed when the chat's tab is `CHAT`; for `DOCS` it is ignored.
4. A turn uses the provider given by `providerId`. Host-only tasks: none of the harness tasks are host-only; image **generation** is (§6.7).
5. A turn expires 10 minutes after creation (`expiresAt`). `expiresAt` moves to now + 10 minutes when the turn enters `READY`, when a search query is approved, and on every new attempt. A `PREPARING`, `AWAITING_APPROVAL` or `READY` turn past `expiresAt` becomes `EXPIRED`. A MESSAGE turn that ends `EXPIRED`, `FAILED` or `CANCELLED` saves **no** assistant message. **Retry** repeats the failed request without duplicating anything: if the failed turn was a regenerate, Retry sends the same `regenerateOf` (the earlier answer is still there); otherwise the user message stays without an answer, the UI shows "No answer saved" + Retry, and Retry sends `answerOf` = that user message's id (no `content`). The same Retry is used after `error` events and `FAILED` results.
6. Open turns (`PREPARING`, `AWAITING_APPROVAL`, `READY`, `GENERATING`, `FINALIZING`) hold a lock: one per chat for `MESSAGE`; one per learning path for `LEARN_QUESTION`, `LEARN_PLAN`, `LEARN_STEP` and `QUIZ` (a step's lock is its path); one per Model Test run for `EVAL_CASE`. `TITLE`, `IMAGE_CLARIFY` and `IMAGE_PROMPT` take no lock. A second turn for a locked item returns `409 CONFLICT` ("Another request for this item is still running.").

#### `POST /api/harness/turns/{id}/complete` (CLIENT generation only)
- Checks in this order: turn `EXPIRED`, or `READY` with `expiresAt` passed (it is marked `EXPIRED`) → `410 TURN_EXPIRED`; any other terminal status → `409 TURN_ALREADY_COMPLETED`; not `READY` → `409 TURN_NOT_READY`; `attempt` differs → `409 TURN_NOT_READY`.
- If the output pipeline itself fails (AI service unreachable or timing out, or an unexpected error while saving), the turn becomes `FAILED` with that `errorCode` and the request answers with the error (`503 AI_SERVICE_UNAVAILABLE`, `504 AI_TIMEOUT` or `500 INTERNAL_ERROR`); the lock is released, so Retry works at once.
- Body limit 32 KB of `content` → `413 PAYLOAD_TOO_LARGE`.
- The server runs the full output pipeline (HARNESS.md §9) and returns the same `TurnResult` that `done` would carry (`200`), or `422 SCHEMA_INVALID` when another attempt is needed.
- `finishReason = ABORTED` (user pressed Stop): MESSAGE with visible text saves the partial answer with status `STOPPED` (`TurnResult.status = COMPLETED`); MESSAGE whose text is empty after reasoning removal → turn `CANCELLED`, `200 TurnResult { status: CANCELLED }`, never a retry; other tasks → `409 CONFLICT` and the turn becomes `CANCELLED` (the browser should call `cancel` instead).

#### `POST /api/harness/turns/{id}/cancel`
- `reason = USER` (default): `PREPARING`, `AWAITING_APPROVAL`, `READY` → `CANCELLED` at once; an open stream receives `cancelled`. `GENERATING` (SERVER): generation is stopped; a MESSAGE with partial text is finalized with `finishReason = ABORTED` and saved as `STOPPED` (response status `FINALIZING`, the stream then receives `done`); otherwise → `CANCELLED` (`cancelled` event).
- `reason = CLIENT_ERROR` (the browser's model failed): accepted only while the turn is `READY` (otherwise `409 CONFLICT`); the turn becomes `FAILED` with `errorCode` = `errorCode` (default `PROVIDER_ERROR`, max 40 characters). Use this instead of leaving the turn open, so the chat is not locked until expiry.
- `FINALIZING` → `409 CONFLICT` (the result is about to arrive); terminal → `409 TURN_ALREADY_COMPLETED`.

#### Turn outcomes
| What happened | Turn status | MESSAGE | Other tasks | Client receives |
|---|---|---|---|---|
| Input blocked (`BLOCK`) or support needed (`SUPPORT`) at prepare | `BLOCKED` | assistant message: status `BLOCKED` (BLOCK) or `COMPLETE` with `meta.guard.action = SUPPORT` | nothing applied | `blocked` |
| No evidence at prepare | `ABSTAINED` | assistant message `ABSTAINED` | — (MESSAGE only) | `abstained` |
| Output accepted | `COMPLETED` | assistant message `COMPLETE` (`STOPPED` if `finishReason = ABORTED`) | result applied, `data` filled | `done` / `200 TurnResult` |
| Output replaced by guardrails (`REPLACE`) or support text (`SUPPORT`) | `BLOCKED` | assistant message `BLOCKED` (REPLACE) or `COMPLETE` + `SUPPORT` | nothing applied; `notice` = refusal/support text; `guardAction` set | `done` / `200 TurnResult` |
| Model used the abstain sentence (RAG/WEB) | `ABSTAINED` | assistant message `ABSTAINED` | — | `done` / `200 TurnResult` |
| Invalid or empty output, attempts left | back to `READY` (CLIENT) / `GENERATING` (SERVER), `attempt + 1` | — | — | `422 SCHEMA_INVALID` (CLIENT); SERVER: `retry` event, then the next attempt streams |
| Invalid or empty output, no attempts left | `FAILED` | no assistant message | nothing applied (LEARN_STEP: content `FAILED`) | `done` / `200 TurnResult { status: FAILED, notice }` |
| Stop with no text, or `cancel` | `CANCELLED` | no assistant message | nothing applied | `cancelled` / `200 TurnResult { status: CANCELLED }` |
| Browser model error (`cancel` with `CLIENT_ERROR`), AI/provider error (also during the output pipeline), stuck > 15 min | `FAILED` | no assistant message | LEARN_STEP: content `FAILED`; EVAL_CASE: error result | `error` (if a stream is open) / the error response of `complete` |
| Expiry | `EXPIRED` | no assistant message | EVAL_CASE: error result `TURN_EXPIRED` | — (`complete` → `410`) |

Refusal, support and abstain texts are prepared texts from `rules/guardrails.yaml` (never machine-translated) and always follow the user's output language: MESSAGE uses the Language rule of §4.4 (`content`, `originalContent`, `translations`); every other place (`notice`, `GUARD_BLOCKED.refusal`, `BlockedEvent.refusal`) uses Khmer when `settings.outputLanguage = KM`, else English.

#### Output retry (`422 SCHEMA_INVALID`)
Every task except `EVAL_CASE` (Model Test grades the first output as it is) and `TITLE` (an empty or unusable title simply keeps the AUTO title: `COMPLETED` with `data = { title: null }`) gets up to 3 attempts. `reason = INVALID`: JSON tasks (`IMAGE_CLARIFY`, `IMAGE_PROMPT`, `LEARN_QUESTION`, `LEARN_PLAN`, `QUIZ`) fail schema or semantic checks, or a `LEARN_STEP` lesson misses a required heading. `reason = EMPTY`: the output is empty after reasoning removal (never when `finishReason = ABORTED`). Example:
```json
{
  "status": 422, "code": "SCHEMA_INVALID",
  "message": "The model returned an invalid answer. Retrying…",
  "details": {
    "reason": "INVALID",
    "errors": ["$.steps: expected at least 4 items, got 2"],
    "attemptsLeft": 2,
    "repairMessages": [
      { "role": "assistant", "content": "<the invalid output, max 2000 chars>" },
      { "role": "user", "content": "Your answer was not valid JSON for the required schema. Problems: $.steps: expected at least 4 items, got 2. Return only corrected JSON." }
    ]
  }
}
```
The client appends `repairMessages` to the prepared `messages`, generates again and calls `complete` with `attempt + 1`. When the third attempt also fails, the turn becomes `FAILED` and the response is `200 TurnResult { status: 'FAILED', notice: "This model couldn't produce a valid result. Try again or choose another model." }`. For SERVER generation the backend does the same retries itself and finally sends `done` with that `TurnResult`.

### 6.5 Providers (`ModelProviderController`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/providers` | Auth | — | `200 ProviderDto[]` | |
| GET | `/api/providers/catalog` | Auth | — | `200 ProviderCatalogDto` | |
| POST | `/api/providers` | Auth | `{ name, kind, baseUrl?, model, apiKey?, makeDefault? }` | `201 ProviderDto` | 400, 422 `URL_NOT_ALLOWED`, 503 `FEATURE_UNAVAILABLE` (REMOTE_URL disabled) |
| PATCH | `/api/providers/{id}` | Auth | `{ name?, baseUrl?, model?, apiKey? }` | `200 ProviderDto` | |
| DELETE | `/api/providers/{id}` | Auth | — | `204` | 409 `CANNOT_DELETE_HOST` |
| POST | `/api/providers/{id}/default` | Auth | — | `200 ProviderDto` | |
| POST | `/api/providers/{id}/test-result` | Auth | `{ ok, checks: {name, ok, message}[], modelInfo?: {name, family?, parameterSize?, quantization?, contextLength?} }` | `200 ProviderDto` | 409 for HOST/REMOTE_URL |
| POST | `/api/providers/{id}/test` | Auth | — | `200 ProviderDto` | 409 for BROWSER/LOCAL_OLLAMA |

Rules:
- `kind = HOST` cannot be created by the client. On `GET /api/providers`, if the AI service reports host chat models and the user has no HOST provider, the backend creates one (`name = "Host model"`, `model = AI default`).
- `kind = BROWSER`: `model` must be one of `catalog.browser.models[].id` or `.fallbackId`; the backend always stores the entry's `id`. The browser chooses the build (q4f16 or the q4f32 fallback) each time it loads the model, from the GPU it is running on (FRONTEND.md §3.5). `baseUrl` must be null.
- `kind = LOCAL_OLLAMA`: `baseUrl` must be `http://localhost:<port>` or `http://127.0.0.1:<port>` (default port 11434). `model` = Ollama tag, 1–100 chars, pattern `^[a-zA-Z0-9._:/-]+$`.
- `kind = REMOTE_URL` (only if `HARNESS_REMOTE_URL_ENABLED=true`): `baseUrl` must be `https://`, pass the URL safety check (GUARDRAILS.md §9), and `apiKey` 1–500 chars is encrypted at rest.
- The first provider a user creates becomes the default automatically.

### 6.6 Documents and jobs (`DocumentController`, `JobController`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/documents` | Auth | `multipart/form-data` field `file` | `201 UploadResponse` | 413, 415, 429 `QUOTA_EXCEEDED` |
| GET | `/api/documents?page=&size=` | Auth | — | `200 PageResponse<DocumentDto>` | |
| GET | `/api/documents/{id}` | Auth | — | `200 DocumentDto` | |
| GET | `/api/documents/{id}/file` | Auth | — | `200` original file, `Content-Disposition: inline` | |
| GET | `/api/documents/{id}/text?page=` | Auth | — | `200 DocumentTextDto` (extracted text of one page; all text if no pages) | |
| GET | `/api/documents/{id}/chunks/{chunkId}` | Auth | — | `200 ChunkDto` | |
| DELETE | `/api/documents/{id}` | Auth | — | `204` (deletes file, chunks, chat links) | |
| GET | `/api/jobs/{id}` | Auth | — | `200 JobDto` | |
| GET | `/api/jobs/{id}/events` | Auth | — | `200 text/event-stream` (§5.2) | |
| POST | `/api/jobs/{id}/cancel` | Auth | — | `200 JobDto` | 409 if already finished |

Upload rules: allowed types `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown` (by extension `.pdf .docx .txt .md` **and** content sniffing); max 25 MB; max 300 pages. The filename is sanitized (BACKEND.md §9.3).

### 6.7 Images (`ImageController`, `FileController`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/image-sessions?page=&size=` | Auth | — | `200 PageResponse<ImageSessionDto>` | |
| POST | `/api/image-sessions` | Auth | `{ title? }` | `201 ImageSessionDto` | |
| PATCH | `/api/image-sessions/{id}` | Auth | `{ title }` | `200 ImageSessionDto` | |
| DELETE | `/api/image-sessions/{id}` | Auth | — | `204` (deletes its images) | |
| GET | `/api/images?sessionId=&page=&size=` | Auth | — | `200 PageResponse<ImageDto>` (newest first) | |
| POST | `/api/images/generate` | Auth | `GenerateImagesRequest` | `202 { jobId }` | 400 `GUARD_BLOCKED`, 503 `FEATURE_UNAVAILABLE`, 429 |
| POST | `/api/images/{id}/variations` | Auth | `{ count: 1–4 }` | `202 { jobId }` | 503, 429 `RATE_LIMITED` / `QUOTA_EXCEEDED` |
| POST | `/api/images/{id}/remove-background` | Auth | — | `202 { jobId }` | 503, 429 `QUOTA_EXCEEDED` |
| DELETE | `/api/images/{id}` | Auth | — | `204` | |
| GET | `/api/files/images/{id}` | Auth | — | `200 image/png` (`Cache-Control: private, max-age=31536000, immutable`) | |

The job result (`JobDto.result`) for IMAGE/VARIATION/BG_REMOVAL is `{ images: ImageDto[] }`. Clarify and prompt rewriting are harness tasks (§6.4) and work with every provider. **Generation and variations need `status.ai.features.images`** (host AI service in the `full` profile); **background removal needs `status.ai.features.bgRemoval`** (on in both profiles; it works on images already in the gallery). When a feature is off its endpoint returns `503 FEATURE_UNAVAILABLE`.

### 6.8 Voice (`VoiceController`, `VoiceWebSocketHandler`)

| Method | Path | Auth | Request | Success |
|---|---|---|---|---|
| POST | `/api/voice/token` | Auth | — | `200 { token, expiresAt }` (single use, 60 s) |
| WS | `/ws/voice?token=<token>` | token | binary + JSON frames (below) | — |
| POST | `/api/voice/tts` | Auth | `{ text: string (1–1000), lang: 'EN' \| 'KM' }` | `200 audio/wav` or `503 FEATURE_UNAVAILABLE` |

WebSocket protocol (`/ws/voice`, same origin, `wss://` in production; Next.js rewrites do not proxy WebSockets, so the frontend connects to `NEXT_PUBLIC_WS_URL`):
1. Client → `{"type":"start","lang":"EN"|"KM"|"AUTO","sampleRate":16000}` (text frame).
2. Server → `{"type":"ready"}`.
3. Client → binary frames: 16-bit little-endian mono PCM at 16 kHz, 512 samples (1024 bytes) per frame.
4. Server → `{"type":"partial","text":"..."}` about once per second while speech continues; `{"type":"final","text":"...","language":"en"}` after ~0.8 s of silence; `{"type":"error","code":"...","message":"..."}` with `code` = `VOICE_BUSY` (all transcription slots in use; try again), `FEATURE_UNAVAILABLE` (voice off on this server) or `INTERNAL_ERROR`.
5. Client → `{"type":"stop"}` to finish early (server sends a `final` for any buffered speech, then closes).
Limits: 60 s per utterance, 5 min per connection, 1 connection per user; the server closes with code 1008 on violation.

### 6.9 Learning (`LearningController`, `QuizController`)

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/learning-paths?page=&size=` | Auth | — | `200 PageResponse<LearningPathDto>` | |
| POST | `/api/learning-paths` | Auth | `{ goal: string (3–200) }` | `201 LearningPathDto` (`INTERVIEWING`, `nextAction = ASK`) | 400 `GUARD_BLOCKED` |
| GET | `/api/learning-paths/{id}` | Auth | — | `200 LearningPathDto` | |
| DELETE | `/api/learning-paths/{id}` | Auth | — | `204` | |
| POST | `/api/learning-paths/{id}/answers` | Auth | `{ answer: string (1–300) }` | `200 LearningPathDto` | 409 if no pending question |
| POST | `/api/learning-paths/{id}/skip-interview` | Auth | — | `200 LearningPathDto` (`PLANNING`, `nextAction = PLAN`) | 409 |
| PUT | `/api/learning-paths/{id}/plan` | Auth | `{ plan: PlanDto }` | `200 LearningPathDto` | 409 unless `AWAITING_APPROVAL`; 400 if plan breaks schema rules |
| POST | `/api/learning-paths/{id}/approve` | Auth | — | `200 LearningPathDto` (`ACTIVE`, steps created, step 1 `CURRENT`) | 409 |
| POST | `/api/learning-paths/{id}/restart` | Auth | — | `200 LearningPathDto` (`INTERVIEWING`, cleared) | |
| GET | `/api/learning-steps/{id}` | Auth | — | `200 LearningStepDto` | |
| GET | `/api/learning-steps/{id}/quizzes` | Auth | — | `200 QuizDto[]` | |
| POST | `/api/quizzes/{id}/submit` | Auth | `{ answers: (number \| null)[] }` | `200 QuizResultDto` | 400 if length ≠ question count |

State machine (backend enforces; `nextAction` tells the frontend what to do next):

| State | `nextAction` | Frontend does | Moves to |
|---|---|---|---|
| `INTERVIEWING`, no pending question | `ASK` | Run harness task `LEARN_QUESTION` | same state with pending question, or `PLANNING` if the model returns `done` |
| `INTERVIEWING`, pending question | `NONE` | Show question; user answers → `POST /answers` | after answer: `ASK`, or `PLANNING` when level+outcome+time are answered or 5 questions were asked |
| `PLANNING` | `PLAN` | Run harness task `LEARN_PLAN` | `AWAITING_APPROVAL` |
| `AWAITING_APPROVAL` | `APPROVE` | Show plan card; user edits (`PUT /plan`) and approves (`POST /approve`) | `ACTIVE` |
| `ACTIVE` | `STUDY` | For the opened step with `contentStatus = EMPTY`, run `LEARN_STEP`; after reading, run `QUIZ`; submit answers | `COMPLETED` when every step is `DONE` |
| `COMPLETED` | `NONE` | Show summary | — |

Quiz rules: a step becomes `DONE` and the next step `CURRENT` when a quiz score ≥ 0.7; `bestScore` keeps the maximum; unlimited retakes (each retake = new QUIZ task).

### 6.10 Model Test (`EvalController`)

| Method | Path | Auth | Request | Success |
|---|---|---|---|---|
| GET | `/api/evals/suites` | Auth | — | `200 EvalSuiteDto[]` |
| POST | `/api/evals/runs` | Auth | `{ providerId, suite: 'core', mode: EvalMode }` | `201 EvalRunDto` (`caseIds` in run order) |
| GET | `/api/evals/runs?providerId=&page=&size=` | Auth | — | `200 PageResponse<EvalRunDto>` |
| GET | `/api/evals/runs/{id}` | Auth | — | `200 EvalRunDetailDto` |
| POST | `/api/evals/runs/{id}/cancel` | Auth | — | `200 EvalRunDto` |

Running a test: the frontend loops over `caseIds` and, for each case that has no result yet, runs a harness turn with `task = EVAL_CASE`, `target = { type: EVAL_RUN, id }`, `taskInput = { caseId }`. Each turn's result is an `EvalResultDto`. Cases run one at a time. If a case's turn ends `FAILED` or `EXPIRED`, the **backend** stores an error result for it (`passed = false`, `error` = the code); the frontend retries such a case once (a new turn replaces the error result) and then moves on. `completedCases` = number of distinct cases with a result. When every case has a result the backend computes the scores and sets `COMPLETED` (error results count as failed). If 5 error results are stored the run becomes `FAILED` ("The model stopped answering") and keeps its partial results. Pausing = the frontend stops looping; the run stays `RUNNING` and can be resumed from the Model Test page.

### 6.11 System and admin

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/api/system/status` | Auth | `200 SystemStatusDto` (cached 10 s) |
| GET | `/api/admin/stats` | ADMIN | `200 { users, chats, messages, documents, turnsToday, guardEventsToday, avgFeedback }` |
| GET | `/api/admin/guard-events?page=&size=&stage=&category=` | ADMIN | `200 PageResponse<GuardEventDto>` |
| GET | `/api/admin/feedback?page=&size=&rating=` | ADMIN | `200 PageResponse<{ messageId, rating, reason, createdAt, excerpt }>` |
| POST | `/api/admin/reload-rules` | ADMIN | `200 { rulesVersion: string, loadedAt: Instant }`; `422 RULES_INVALID { errors }` if the new rules fail validation (the old rules stay active) |

---

## 7. Example: one complete MESSAGE turn (CLIENT generation)

```
POST /api/harness/turns
{ "task":"MESSAGE", "providerId":"…", "chatId":"…", "content":"How much is the library late fee?", "outputLanguage":"EN" }

event: turn
data: {"turnId":"t1","task":"MESSAGE","generation":"CLIENT","userMessage":{…},"expiresAt":"…"}

event: status
data: {"stage":"CHECKING_INPUT"}

event: status
data: {"stage":"RETRIEVING"}

event: sources
data: [{"n":1,"kind":"DOC","title":"handbook.pdf","documentId":"…","chunkId":"…","page":1,"snippet":"Students may borrow up to 3 books…","score":0.71}]

event: prepared
data: {"turnId":"t1","messages":[{"role":"system","content":"You are …"},{"role":"user","content":"REFERENCE DATA …"}],"params":{"temperature":0.2,…},"outputSchema":null,"modelProfile":{…},"clientGuard":{…},"attempt":1}
```
Browser generates with the visitor's model, then:
```
POST /api/harness/turns/t1/complete
{ "content":"The late fee is 500 riel per book for each day after the due date [1].", "finishReason":"STOP",
  "stats":{"model":"qwen2.5:1.5b","ttftMs":620,"tokensPerSec":31.2,"outputTokens":24,"totalMs":1400}, "attempt":1 }

200 { "turnId":"t1","task":"MESSAGE","status":"COMPLETED","message":{ …"meta":{"grounding":{"level":"GROUNDED",…}}… },"data":null,"notice":null }
```
