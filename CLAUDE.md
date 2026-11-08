# CLAUDE.md — Lumen (Local AI Learning Assistant)

Persistent memory for AI coding agents. Read this first; it replaces re-reading every spec document.
The full spec lives in `docs/` (reading order: OVERVIEW → API_CONTRACT → HARNESS → GUARDRAILS → RULES → BACKEND →
AI_SERVICE → FRONTEND → HOSTING). **`docs/API_CONTRACT.md` wins for API shapes, `docs/HARNESS.md` for AI behaviour.**
For anything else unclear: ask the owner and record the answer under *Decisions*.

---

## 1. Project summary

A ChatGPT-style **learning assistant whose AI runs locally**, Khmer + English, with a **model harness** around the model.
Product name in the UI: **Lumen**. Target: a **local demo on the owner's MacBook** (M1 Pro, 16 GB). No hosting/deploy work.

Tabs and features:
- **Chat** — study assistant; optional web search with sources (right sidebar).
- **Documents** — upload PDF/DOCX/TXT/MD, ask questions; answers cite and highlight the source paragraph (RAG).
- **Image** — clarify the idea → approve an improved prompt → generate (FLUX.2 klein) → background removal.
- **Learning paths** — interview → plan approval → short lessons → quizzes → progress.
- **Voice input**, **Khmer ↔ English** answers (NLLB pivot), **human-in-the-loop** approvals.
- **Bring your own model** — visitors run a model in the browser (WebLLM) or connect their own Ollama, and get our
  rules, guardrails, search and tests. **Model Test** scores any model inside the harness.

Six design laws (HARNESS §0): 1 evidence over memory · 2 code decides, the model writes · 3 one small job per model call ·
4 same rules for every model · 5 verify after generating · 6 fail visibly.

## 2. Architecture

```
 Browser (Next.js, frontend/)
 │  /api/* via a Next.js Route Handler proxy (same origin, httpOnly JWT cookies, SSE streaming)
 │  CLIENT generation for BROWSER (WebLLM) and LOCAL_OLLAMA (http://localhost:11434) providers
 ▼
 Backend — Spring Boot 4.1, Java 21 (backend/) — orchestrator + system of record   :8080
 ├──► PostgreSQL 16 + pgvector (Docker, host port 5433)
 ├──► storage/ (shared files: uploads, page texts, images)
 ▼  internal HTTP + SSE + WebSocket, header X-Internal-Token
 AI service — Python FastAPI (ai-service/) — harness core + model runtime   :8001
 ├──► Ollama (native, :11434): llama3.2 (chat, 3B), embeddinggemma (embeddings)
 └──► SearXNG (Docker, :8888)
```

| Who | Owns | Never does |
|---|---|---|
| Frontend | UI, client generation with the visitor's model, advisory client guard | Calls the AI service or our Ollama directly |
| Backend | Auth, data, turn lifecycle, persistence, limits, applying results | Builds prompts or judges text |
| AI service | All text analysis, prompts, checks, retrieval, HOST/REMOTE generation, grading | Auth, users, writing any table except `chunks` |

**Turn protocol** (`POST /api/harness/turns`, SSE) — one protocol for every task and provider:
1. Backend validates, takes the lock (one open turn per chat / learning path / eval run), saves the user message, sends `turn`.
2. Backend calls AI `POST /harness/prepare` (SSE): normalize → guard input → language pivot → route (CHAT/RAG/WEB) → tools → retrieval/web → prompt.
3. Prepare may end early: `blocked` (guard), `abstained` (no evidence), `approval` (web query needs approval).
4. CLIENT providers (BROWSER, LOCAL_OLLAMA): backend sends `prepared` (messages, params, schema, profile, clientGuard); browser generates and calls `POST /turns/{id}/complete`.
5. SERVER providers (HOST, REMOTE_URL): backend calls AI `POST /generate` (SSE) and relays `token` events.
6. Backend calls AI `POST /harness/finalize`: reasoning strip, output guard, link policy, grounding, JSON schema + semantic checks, translation.
7. Invalid/empty output → retry (max 3 attempts; `retry` event for SERVER, `422 SCHEMA_INVALID` + `repairMessages` for CLIENT).
8. Valid → the task handler applies the result (save message, title, plan, lesson, quiz, eval result).
9. Backend sends `done` (`TurnResult`) and releases the lock. Cancel/expiry/failure always release the lock.
10. Failed, cancelled and expired MESSAGE turns save **no** assistant message; Retry uses `answerOf`/`regenerateOf`.

SSE events (turn): `turn`, `status`, `sources`, `tools`, `token`, `retry` (non-terminal) · `approval`, `blocked`,
`abstained`, `prepared`, `done`, `cancelled`, `error` (terminal). Jobs: `progress`, `done`, `error`. Heartbeat `: ping` every 15 s.

Turn outcomes (API_CONTRACT §6.4):

| What happened | Turn status | MESSAGE saves | Client receives |
|---|---|---|---|
| Input BLOCK / SUPPORT at prepare | BLOCKED | assistant `BLOCKED` (BLOCK) or `COMPLETE` + guard SUPPORT | `blocked` |
| No evidence at prepare | ABSTAINED | assistant `ABSTAINED` | `abstained` |
| Output accepted | COMPLETED | `COMPLETE` (`STOPPED` if finishReason ABORTED) | `done` / 200 TurnResult |
| Output REPLACE / SUPPORT | BLOCKED | `BLOCKED` or `COMPLETE`+SUPPORT | `done` / 200 |
| Model used the abstain sentence | ABSTAINED | `ABSTAINED` | `done` / 200 |
| Invalid/empty, attempts left | READY (CLIENT) / GENERATING (SERVER), attempt+1 | — | 422 / `retry` |
| Invalid/empty, no attempts left | FAILED | nothing | `done` FAILED + notice |
| Stop with no text, or cancel | CANCELLED | nothing | `cancelled` |
| Provider/AI error, stuck > 15 min | FAILED | nothing | `error` |
| Expiry (10 min, extended on READY/approval/attempt) | EXPIRED | nothing | `complete` → 410 |

## 3. Repository map

```
AIProjectRepo/                 (git root; remote github.com/cod-itor/Lumen-Local-AI, branch main)
├── CLAUDE.md                  this file
├── README.md                  how to run the whole stack
├── docker-compose.yml         postgres (pgvector/pgvector:pg16) + searxng, bound to 127.0.0.1
├── infra/searxng/settings.yml SearXNG config (json format on)
├── docs/                      spec package (OVERVIEW, API_CONTRACT, HARNESS, GUARDRAILS, RULES, BACKEND, AI_SERVICE, FRONTEND, HOSTING)
├── rules/                     AI behaviour, no code (RULES.md)
│   ├── system_prompt.md       shared system prompt
│   ├── modes/                 chat, rag, web, title, image_clarify, image_prompt, learning_interview, learning_plan, learning_step, quiz, translate
│   ├── schemas/               image_clarify, image_prompt, learning_plan, learning_question, quiz (JSON Schema 2020-12)
│   ├── harness.yaml           budgets, generation params, router patterns, thresholds ([CALIBRATE])
│   ├── guardrails.yaml        categories, patterns, refusal/support/abstain texts (EN + KM)
│   ├── models.yaml            model profiles + WebLLM catalog + Ollama suggestions
│   ├── knowledge/             (reserved)
│   └── evals/                 suites/core.yaml (48 cases, 22 quick) + fixtures/
├── frontend/                  Next.js 16 app (wired to the API from phase 4)
├── backend/                   Spring Boot 4.1 monolith — package com.learnai (BACKEND.md §2) [phase 1+]
├── ai-service/                Python FastAPI — package app (AI_SERVICE.md §3) [phase 2+]
└── storage/                   shared files (git-ignored)
```
`Document-Support/` at the root is the owner's original research package; it is git-ignored (copied into docs/ + rules/).

### Frontend (`frontend/`)
- Next.js 16.x (App Router, Turbopack, `cacheComponents`), React 19, TypeScript strict, Tailwind v4, shadcn (base-nova /
  Base UI), motion, next-themes (dark default), react-hook-form + zod. **npm** (not pnpm).
- i18n: own store (`src/i18n/` — `useMessages`, `useLocale`, `setLocale`, `Localized<T>`), EN + KM. Not next-intl.
- Live data: `lib/api.ts` (fetch + refresh-once), `lib/sse.ts`, `lib/session.tsx` (me/chats/providers), `lib/harness/useHarnessTurn.ts`.
  Chat and Documents use the live API (`lib/documents.tsx` = DocumentsProvider in the app shell); image/learn still read `src/mocks/*` until their phases.
- Routes: `/` landing · `/(auth)/login|signup|verify|forgot-password|reset-password` · `/(app)/chat[/id]`,
  `/documents[/id]`, `/image[/id]`, `/learn` · `/settings` · `/coming-soon`.
- Next 16: `middleware.ts` is `proxy.ts`. Read `frontend/node_modules/next/dist/docs/` before using Next APIs (see frontend/AGENTS.md).

### Backend (`backend/`) — see BACKEND.md §2 for every class
`config/ security/ controller/ dto/{request,response,ai}/ entity/{,enums}/ repository/ service/{,impl}/ harness/{,task}/
client/ job/ storage/ scheduling/ exception/ util/`. Flyway migration `src/main/resources/db/migration/V1__init.sql`.

### AI service (`ai-service/`) — see AI_SERVICE.md §3
`app/{main,config,auth,errors,db}.py`, `app/rules/` (loader, models, render), `app/harness/` (prepare, finalize, normalize,
language, router, tools, history, budget, prompt_builder, params, grounding, structured, loops, profiles), `app/guard/`
(engine, prompt_guard, llama_guard, markdown_policy, url_safety), `app/rag/` (parsing, cleaning, chunking, ingest,
embeddings, retrieval), `app/web/` (searxng, fetch, extract, evidence), `app/models/` (ollama_runtime, remote_runtime,
translator, images, bg_removal, stt, tts, manager), `app/evals/` (suites, fixtures, graders), `app/api/` routers;
`scripts/` (download_models, validate_rules, run_evals, calibrate); `tests/`.

## 4. Tech stack and models

| Part | Versions |
|---|---|
| Frontend | Next 16.x, React 19, TS 5, Tailwind 4, Node 26 / npm 11 |
| Backend | Java 21 target (JDK 24 installed), Spring Boot 4.1.x, Maven wrapper, jjwt 0.13, springdoc 3.0.x, bucket4j 8, MapStruct 1.6, Lombok, Flyway, Testcontainers |
| AI service | Python 3.12 via uv, FastAPI, sse-starlette, ollama client, httpx, psycopg 3 + pgvector, Pydantic v2, jsonschema, PyYAML, pypdf, python-docx, trafilatura, khmercut, ctranslate2, faster-whisper, silero-vad, mflux, rembg |
| Data | PostgreSQL 16 + pgvector 0.8 (Docker), SearXNG (Docker) |

| Job | Model | License |
|---|---|---|
| Host chat | `llama3.2` 3B (Ollama, 2.0 GB, num_ctx 8192) — owner's installed model; spec default `gemma4:e2b-it-qat` is optional | Llama 3.2 Community |
| Embeddings | `embeddinggemma` (768-dim, fixed query/document prefixes) | Gemma ToU |
| Translation | NLLB-200 distilled 600M, CTranslate2 int8 | **CC-BY-NC (non-commercial)** |
| Images | FLUX.2 [klein] 4B via mflux (Mac, 8-bit) | Apache 2.0 |
| Background removal | rembg `isnet-general-use` (never the default bria model) | Apache 2.0 |
| STT EN / KM | faster-whisper `small` / `seanghay/whisper-small-khmer-v2` → CT2 | MIT / Apache 2.0 |
| Optional guards | llama-guard3:1b, Prompt Guard 2 22M, granite3-guardian:2b (all off by default) | various |

## 5. How to run (local demo)

Order: Docker services → Ollama → AI service → backend → frontend.
```bash
open -a Docker && docker compose up -d postgres searxng          # from the repo root
ollama pull llama3.2 && ollama pull embeddinggemma                # once (≈2.6 GB total)
cd ai-service && cp .env.example .env && uv sync    # INTERNAL_TOKEN = backend AI_SERVICE_TOKEN
uv run python scripts/validate_rules.py                                # rules/ loader checks
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
uv run python scripts/download_models.py --translation --background   # per feature; --images needs `uv sync --group images` (or ./setup.sh --images)
cd backend && cp .env.example .env && ./mvnw spring-boot:run           # Flyway migrates on start (fill JWT_SECRET etc.)
open http://localhost:8080/swagger-ui.html
cd frontend && npm install && npm run dev                              # http://localhost:3000
```
Tests: `cd backend && ./mvnw test` · `cd ai-service && uv run pytest` · `cd frontend && npx tsc --noEmit && npx eslint src && npx next build`.
Evals: `cd ai-service && uv run python scripts/run_evals.py --mode QUICK|FULL [--case id] [--verbose]` (host model, in
process) or the `/test` page for any provider. Calibration: `scripts/calibrate.py` (TODO phase 14).

Memory plan (16 GB): always loaded llama3.2 3B (~2.5–3 GB) + EmbeddingGemma (~0.6 GB) + NLLB int8 (~0.6 GB); on demand
Whisper (~0.5 GB) and FLUX.2 klein (opt-in, unloaded after each job).

Disk budget (Mac has ~135 GB free): Ollama models ≈ 2.6 GB; `download_models.py` fetches only what a feature needs —
NLLB int8 ≈ 0.6 GB, Whisper small EN + KM ≈ 0.5 GB, rembg isnet ≈ 0.2 GB; FLUX.2 klein (≈ 4–8 GB) only with `--images`.
Model caches live in `ai-service/models/` (git-ignored). Ollama + AI service run natively (Apple GPU), not in Docker.

## 6. Environment variables

**backend/.env** — `SERVER_PORT` (8080) · `PUBLIC_URL` site origin for CSRF + cookies (http://localhost:3000) · `DB_URL`,
`DB_USERNAME`, `DB_PASSWORD` · `JWT_SECRET` ≥ 32 bytes · `JWT_ACCESS_MINUTES` (30) · `JWT_REFRESH_DAYS` (14) ·
`AI_SERVICE_URL` / `AI_SERVICE_WS_URL` · `AI_SERVICE_TOKEN` (= ai-service `INTERNAL_TOKEN`) · `STORAGE_DIR` (../storage) ·
`MAX_UPLOAD_MB` (25) · `USER_STORAGE_QUOTA_MB` (500) · `SPRINGDOC_ENABLED` · `HARNESS_TURN_TTL_MINUTES` (10) ·
`HARNESS_MAX_COMPLETION_KB` (32) · `HARNESS_REMOTE_URL_ENABLED` (false) · `FORCE_STRICT_PROFILE` · `PROVIDER_KEY_SECRET`
(32 bytes base64) · `ADMIN_EMAILS` (comma list → ADMIN at registration).

**ai-service/.env** — `HOST`, `PORT` (8001) · `INTERNAL_TOKEN` · `AI_PROFILE` (full|lite) · `APP_NAME` · `DATABASE_URL` ·
`RULES_DIR` (../rules) · `STORAGE_DIR` (../storage) · `MODELS_DIR` · `PUBLIC_URL` · `OLLAMA_HOST`, `OLLAMA_CHAT_MODEL`,
`OLLAMA_EMBED_MODEL`, `OLLAMA_KEEP_ALIVE`, `EMBED_DIM` (768) · `SEARXNG_URL` (http://localhost:8888) ·
`TRANSLATION_MODEL_DIR`, `TRANSLATION_TOKENIZER` · `WHISPER_EN_MODEL`, `WHISPER_KM_MODEL_DIR` · `IMAGE_BACKEND` (mflux),
`IMAGE_MODEL`, `IMAGE_QUANTIZE`, `IMAGE_UNLOAD_AFTER_JOB` · `REMBG_MODEL` · `GUARD_INJECTION_CLASSIFIER`,
`PROMPT_GUARD_MODEL`, `HF_TOKEN`, `GUARD_CONTENT_CLASSIFIER`, `GUARD_CONTENT_MODEL` · `IDLE_UNLOAD_MINUTES` ·
`LOG_PROMPTS` · optional `FEATURE_*` overrides.

**frontend/.env.local** — `BACKEND_URL` (http://localhost:8080) · `NEXT_PUBLIC_WS_URL` (ws://localhost:8080) ·
`NEXT_PUBLIC_APP_ORIGIN` (http://localhost:3000).

## 7. Conventions

- **Java:** layered packages; controllers only map HTTP + `@Valid` + call one service; services hold logic,
  `@Transactional` (readOnly on reads); every query filters by the owner `userId`; entities never leave services
  (MapStruct → DTO records); Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder` on entities, **never
  `@Data`**; constructor injection; Flyway-only schema changes (`ddl-auto: validate`); Swagger annotations.
- **TypeScript:** strict, no `any`; server calls only through `lib/api.ts` / `lib/sse.ts`; model calls only through
  `lib/providers/*`; every async view has loading, empty and error states; all copy in EN + KM.
- **Python:** type hints, Pydantic, async, ruff, no `eval`; errors as `{"code","message"}`.
- **Errors:** API_CONTRACT §3 body `{timestamp,status,code,message,path,details}`; codes from §3.2 only.
- **Commits:** one commit per build phase (OVERVIEW §6), conventional style (`feat(backend): phase 1 …`), authored only by
  the owner, **no Co-Authored-By / AI attribution lines**. Push to `origin main` after the phase passes its check.

## 8. Hard rules (OVERVIEW §7)

1. API_CONTRACT.md is the single source of truth for public endpoints, DTOs, enums and events.
2. Prompts, thresholds, patterns and policies live in `rules/`; never hard-code them in Java/Python/TypeScript.
3. The model never chooses tools or actions; code does.
4. Every query on user data filters by the user id.
5. Guardrails that matter run on the server; client checks are advisory.
6. No model output is ever rendered as HTML or images; links only to this turn's sources.
7. Never ask visitors to expose Ollama to the internet; never suggest `OLLAMA_ORIGINS=*`.
8. Every outgoing request to an external URL goes through the URL safety validator.
9. Structured model output is always schema-validated and semantically checked; failures use the repair loop.
10. Model Test grading is deterministic code, never an LLM judge.
11. Secrets only in `.env` files; never in prompts, logs or the repo.
Plus: don't change `rules/` prompts or thresholds without running the Model Test (RULES.md §7).

## 9. Current status

| # | Phase | Status |
|---|---|---|
| 0 | Monorepo setup, docs, rules, compose, CLAUDE.md | **done** (2026-11-08) |
| 1 | Database + backend auth | **done** (2026-11-08) — Flyway V1, register/login/refresh(rotation+reuse)/logout/me, settings, delete account, CSRF origin check, rate limits, Swagger; `AuthFlowIntegrationTest` (Testcontainers) |
| 2 | AI service skeleton + rules loader | **done** (2026-11-08) — FastAPI app, X-Internal-Token, rules loader with all RULES.md §2 checks, `/health` `/capabilities` `/status` `/rules/reload` `/models/catalog` `/models/profile` `/evals/suites`, `validate_rules.py`, pytest |
| 3 | Harness CHAT (HOST) | **done** (2026-11-08) — AI: normalize, language, router (intents/notes/suggestions), history 4–6, budget + exact prompt layout, params, client guard, Ollama runtime (slots + `queued`, reasoning/stop/loop/guard stops), finalize F1–F4/F8/F11(CHAT)/F14; backend: providers (auto HOST), chats/messages API, `POST /api/harness/turns` SSE, complete/cancel/get, TurnRunner on virtual threads, conditional status changes, MESSAGE handler (AUTO title, preview), turn_metrics, housekeeping. DOCS tab abstains (`NO_DOCUMENTS`) until phase 6 |
| 4 | Frontend wiring | **done** (2026-11-08) — `/api/*` streaming proxy, `proxy.ts` route guard, login/signup live, session provider (user, chat list, providers), live chat thread (SSE turn, Stop, regenerate, versions, suggestions, markdown), new chat flow |
| 5 | Client providers (WebLLM, local Ollama) | **done** (2026-11-08) — provider create/update/delete/test/test-result API; `lib/providers/*` (WebLLM worker engine, visitor Ollama, WebGPU f16 build pick, registry, connection test), client guard + reasoning strip, CLIENT turns in `useHarnessTurn` (load before turn, `prepared` → generate → `complete`, 422 repair loop, CLIENT_ERROR cancel), `/settings/models` page (add browser model / My Ollama guide, default, test, remove, remove downloaded files), CSP + security headers |
| 6 | Documents (RAG) + grounding | **done** (2026-11-08) — upload (size/type sniff/quota/dedupe) → INGEST job (claim `SKIP LOCKED`, SSE `/api/jobs/{id}/events`, cancel) → AI parse (pypdf/python-docx/txt/md) → clean → chunk → EmbeddingGemma → `chunks`; retrieval (exact cosine + `tsv` lexical, RRF, gate, per-doc caps, evidence budget); grounding verifier (citations, lexical/semantic support, numbers, quotes, auto-fix/auto-cite, UTF-16 offsets); live Documents tab (library + dropzone, sidebar, DOCS chats, source picker → chat `documentIds`, file viewer with page nav + chunk highlight, citation chips + inline `[n]`, grounding badge, unsupported-sentence underline) |
| 7 | Guardrails | **done** (2026-11-08) — `app/guard/` engine (input §5.1 decision order, output §5.3, leak shingles §5.4, SAFE_COMPLETE notes + disclaimers, refusals EN/KM, TEST `wouldAction`, image policy), output Markdown policy (images, HTML, source-URL-only links, paragraph cut), URL safety validator (private ranges, IP spellings, DNS check), DOC chunk injection flag + label, hardened reminder on FLAG, optional Llama Guard / Prompt Guard (env opt-in), `/guard/check`, `/guard/check-url`; backend stores `guard_events`; 82 guard tests |
| 8 | Translation + tools | **done** (2026-11-08) — calculator (word/symbol/percent normalization, range and date blanking, whitelist `ast` + `Fraction`, never `eval`, F12 exact-result enforcement), DATETIME tool (now, weekday of a date, days until/between), NLLB-200 600M int8 via CTranslate2 + SentencePiece (no torch at runtime), Markdown-safe `translate_markdown` (code/URLs/citations kept, LRU cache), host-model fallback, P6 KM→EN pivot, F13 KM / BOTH output (prepared texts for abstains), `/translate`; UI: Show original toggle, EN+KM side by side, "Calculated by the app" card |
| 9 | Model Test | **done** (2026-11-08) — AI: `evals/graders.py` (every §12.3 check, deterministic), `evals/fixtures.py` (in-memory fixture corpus, `fx:` chunk ids, forced top 3), EVAL_CASE prepare (profile TEST, seed 42, EN output, `answerLanguage` override) + finalize (case's own finalize once, grade F1–F3 text, `guardWouldBlock`); structured tasks for every non-MESSAGE task (`harness/structured.py`: task input blocks §7.7, JSON extraction + repairs, schema + RULES §5 semantic checks, repair messages, TITLE cleaning, lesson headings); `scripts/run_evals.py`. Backend: `eval_runs`/`eval_results`, `/api/evals/*`, generic `TaskHandler` (target + lock, taskInput, apply, onTerminal) with `EvalCaseTaskHandler` + `TitleTaskHandler`, error results on FAILED/EXPIRED, 5 errors → FAILED, scores from `rules/harness.yaml → evals.weights`. Frontend: `/test` (start Quick/Full, progress, pause/resume/cancel, scorecard, failed cases, history + compare), `lib/harness/runTask.ts` (non-MESSAGE turns, SERVER + CLIENT with repair loop), module-level runner store |
| 10 | Web search | **done** (2026-11-08) — AI: `web/searxng.py` (JSON API, `WEB_UNAVAILABLE`), `guard/url_safety.safe_get` (every hop checked, connect to the validated IP with original Host + SNI, ≤ 3 manual redirects, size/time limits), `web/extract.py` (trafilatura, precision, tables kept), `web/evidence.py` (query rule §7.4.1, filter + per-domain cap, parallel fetch, chunk 300 tokens, embed, 24 h cache in `chunks` `source=WEB`, best 2 per page / 5 overall, injection-flagged chunks dropped), WEB prepare (edited query re-checked by the input guard, `needs_approval`, SEARCHING → READING, abstain `NO_WEB_RESULTS` / `WEB_UNAVAILABLE`), hourly purge; WEB grounding reuses F9–F11. Backend: `POST /api/harness/turns/{id}/approval` (APPROVE / EDIT 1–200 chars, AWAITING_APPROVAL → PREPARING, query stored in the request, same TurnRunner). Frontend: approval wait in `useHarnessTurn` (`respond`, Stop cancels), `SearchApproval` card, WEB source chips (links, `noopener noreferrer`), WEB grounding badge, TURN_ON/VERIFY_WITH_WEB_SEARCH re-ask, "Ask before searching" switch in Settings → Privacy |
| 11 | Learning paths + quizzes | **done** (2026-11-08) — Backend: `learning_paths`/`learning_steps`/`quizzes`/`quiz_attempts` entities, `LearningService` (create with `/guard/check`, answers, skip, plan edit with §9.9 checks, approve → steps, restart, quiz submit: score, best score, ≥ 0.7 unlocks the next step or completes the path; answers hidden until submit), `/api/learning-paths`, `/api/learning-steps`, `/api/quizzes`; task handlers LEARN_QUESTION / LEARN_PLAN / LEARN_STEP (FAILED → contentStatus FAILED) / QUIZ, lock `path:{id}`, 409 while a turn holds it. AI: quiz answer–evidence check (`rules/harness.yaml → quiz`). Frontend: live `/learn` (path list + new goal, interview with option chips, editable plan + approve, step list + lesson Markdown + quiz → result with explanations/evidence, retake, restart, delete) |
| 12 | Images | **done** (2026-11-08) — AI: `images/flux.py` (mflux 0.23 `Flux2Klein`, prebuilt 4-bit weights, one job at a time, unload after job, progress QUEUED → LOADING_MODEL → GENERATING), `images/background.py` (rembg 2.0.85 `isnet-general-use`), `/images/generate`, `/images/variations` (SSE), `/images/remove-background`; paths relative to STORAGE_DIR, `.png` only; IMAGE_PROMPT pivots a Khmer request to English for "Use my original"; clarify drops questions about details the request already gives and the prompt must keep the request's subject (`rules/harness.yaml → image`). Backend: `image_sessions`/`images`, `ImageService` (feature check → 503 FEATURE_UNAVAILABLE, shared storage quota, IMAGE_PROMPT guard), `ImageJobHandler` (IMAGE / VARIATION / BG_REMOVAL, one image slot), `/api/image-sessions`, `/api/images/*`, `/api/files/images/{id}`, IMAGE_CLARIFY / IMAGE_PROMPT task handlers, `GET /api/system/status`. Frontend: live Image tab (`lib/images.tsx` sessions + features, `components/image/live/image-studio.tsx`: clarify chips + Skip, editable approval card with Generate / Use my original / Cancel, aspect ratio + count, job progress, session gallery, selected-image panel with variations / remove background / download / delete), sidebar sessions; mocks removed |
| 13 | Voice | **done** (2026-11-08) — AI: `voice/stt.py` (faster-whisper 1.2.1 small EN int8 CPU + `seanghay/whisper-small-khmer-v2` → CT2 int8; Silero VAD v6 ONNX bundled with faster-whisper, run frame by frame with its h/c state; 800 ms silence → final, ~1 s partials, 60 s utterance cap, AUTO = Whisper language detection on the first 3 s → Khmer model if km ≥ 0.5), `WS /voice/stream` (internal token, 2 connections service-wide → VOICE_BUSY, 5 min limit), `POST /voice/tts` → 503 (read aloud off). Backend: `POST /api/voice/token` (Caffeine, single use, 60 s, rate limit), `/ws/voice` relay (`VoiceWebSocketHandler`: one connection per user, origin = PUBLIC_URL, java.net.http upstream with chained sends, 5 min limit), `POST /api/voice/tts` (503 unless `features.tts`). Frontend: `lib/status.tsx` (shared `/api/system/status`), `public/pcm-worklet.js` (16 kHz Int16 512-sample frames, resamples if needed), `lib/voice/use-voice.ts`, Composer mic = live voice (partial text, finals appended, level bars from the mic, errors inline, hidden when voice is off; decorative on the landing page) |
| 14 | Calibration + polish | next |

## 10. Decisions log

- 2026-11-08 — **One monorepo** (`Lumen-Local-AI`); the built frontend moved to `frontend/` with history kept (git rename).
- 2026-11-08 — **Local demo only**: everything runs on the MacBook (Option 1 of HOSTING.md without a tunnel). No deploy scripts.
- 2026-11-08 — **One commit per phase** (owner's request); no granular commits.
- 2026-11-08 — Frontend keeps its own stack where the spec differs: own i18n store instead of next-intl, npm instead of pnpm,
  no TanStack Query/Zustand unless a phase needs them. Spec routes `/test` (Model Test) and `/settings/models` get built in phase 5/9.
- 2026-11-08 — Docker binds Postgres and SearXNG to 127.0.0.1 only.
- 2026-11-08 — **Light models, owner's own Ollama**: host chat = `llama3.2` (3B, already installed) instead of
  `gemma4:e2b-it-qat` (saves 4.3 GB disk and ~2 GB RAM). `OLLAMA_CHAT_MODEL` switches it. llama3.2 is not Khmer-native →
  KM answers go through the NLLB pivot. Embeddings stay `embeddinggemma` (621 MB, multilingual). Heavy models (FLUX.2
  klein) are opt-in downloads; optional guard classifiers stay off.
- 2026-11-08 — Backend on Spring Boot **4.1.2** (latest GA), springdoc 3.2.0, Bucket4j 8.22, MapStruct 1.6.3, jjwt 0.13.0.
  Rate limits: `@RateLimit("bucket")` + interceptor (`.ip` buckets keyed by IP, others by user); `auth.login.email`
  is checked in `AuthServiceImpl`. JDBC URL uses `stringtype=unspecified` (citext email). Entities are added per phase
  (Hibernate `validate` only checks mapped tables).
- 2026-11-08 — AI service: Python 3.12 via uv, deps added per phase (heavy model libs only in their phase).
  `/capabilities` reports a feature as on only when its model/library is actually installed. Paths in
  ai-service/.env are resolved relative to `ai-service/`. Allowed schema annotations: `$schema`, `$id`, `title`, `description`.
- 2026-11-08 — Stack fixed by the spec and confirmed by the owner: AI service = Python FastAPI, backend = Spring Boot.
- 2026-11-08 — Phase 3: internal AI payloads are handled as Jackson `JsonNode` trees (no `dto/ai` records) and JSONB
  columns map to `JsonNode` via `JsonNodeConverter` (text + `stringtype=unspecified`; test containers set the same URL
  param). `WebClient.builder()` is used directly (Boot 4 has no `WebClient.Builder` bean without the webclient module).
  Status changes = native conditional `UPDATE … WHERE status IN (…)` or a row-locked read-check-write (`TurnStore`).
  Not-yet-built parts answer honestly: input guard = ALLOW (phase 7), no pivot translation/tools (phase 8), RAG/WEB →
  `NOT_IMPLEMENTED` (phases 6/10), non-MESSAGE tasks → 503 `FEATURE_UNAVAILABLE`.

- 2026-11-08 — Phase 4: signup goes straight into the app (no OTP step in the local demo); the Composer's web search is
  off by default until phase 10; `/chat/[id]` uses `export const instant = false` (cacheComponents). Markdown =
  react-markdown 10 + remark-gfm 4 with `skipHtml` and no images. `npm audit --omit=dev` is clean; the remaining advisories
  are dev-only (shadcn CLI deps).

- 2026-11-08 — Phase 5: `@mlc-ai/web-llm` 0.2.87 (exact pin; official MLC maintainers, one dependency); every
  catalog id in `rules/models.yaml` exists in its `prebuiltAppConfig`. REMOTE_URL providers stay off (503
  `FEATURE_UNAVAILABLE`) in the local demo. HOST `test` runs a 5-token generation through the AI service. A test result
  with a smaller `contextLength` stores `profileOverrides.contextWindow` and re-resolves the profile.

- 2026-11-08 — Phase 6: PDF parsing uses **pypdf 6.21.2** instead of PyMuPDF (PyMuPDF is AGPL and heavy; pypdf 7.0
  was too new to pin). pgvector is used **without numpy** (`pgvector.Vector`, `.to_list()` on reads). Chunk offsets are
  page-relative; the viewer falls back to a text search if they don't line up. Input/output guard checks and the
  NLLB pivot for Khmer documents arrive in phases 7/8. The first DOCS message creates the chat with the picked
  `documentIds`; `/documents/[id]?chat=` opens a specific DOCS chat.

- 2026-11-08 — Phase 7: classifiers stay **off** in the local demo (no transformers/torch, no llama-guard pull);
  STRICT then uses regex rules only. Turn on with `GUARD_CONTENT_CLASSIFIER=true` (+ `ollama pull llama-guard3:1b`)
  or `GUARD_INJECTION_CLASSIFIER=true` (needs transformers + HF token). Rule fixes found by the rule tests (Model Test
  to confirm in phase 9): `drug_synthesis` also matches "making/cooking…", `fraud_cheating_systems` needs an
  instruction phrase ("how banks detect counterfeit notes" stays allowed), `strict_dating` ignores "carbon dating".
  The URL validator checks scheme/host/ports/DNS now; IP pinning + manual redirects are built with the web fetcher
  (phase 10). Guard events are written by the backend from `guardEvents[]` of prepare and finalize.

- 2026-11-08 — Phase 8: NLLB was converted from Meta's **official** `facebook/nllb-200-distilled-600M` (owner's choice)
  with `scripts/download_models.py --translation` (temporary venv: torch 2.14.1, transformers 4.57.6, ctranslate2
  4.8.3 — deleted after). Runtime deps: `ctranslate2==4.8.3`, `sentencepiece==0.2.2` (pulls numpy). Model: 604 MB in
  `ai-service/models/` (git-ignored). Decoding uses `repetition_penalty 1.2`, `no_repeat_ngram_size 4`; spaces
  between Khmer words are removed after decoding.

- 2026-11-08 — **Product scope (owner):** visitors bring their own model (WebLLM in the browser or their own Ollama);
  the platform runs the harness only (rules, guardrails, routing, grounding, grading, data, search) plus small helper
  models (EmbeddingGemma, NLLB, later Whisper/rembg). A future server needs no GPU: about 2 vCPU / 4–8 GB RAM. The host
  llama3.2 is for the owner's local demo and testing. FLUX image generation is the one feature visitors cannot bring
  themselves (needs a GPU host). Still local only — no deploy work until the owner decides (HOSTING.md).

- 2026-11-08 — Phase 9: **Model Test scores (llama3.2 HOST, suite core v2)** — rules `rules-dfd852604a50`: Quick 22/22
  in-process and 0.964 through the API (KHMER rag case varies run to run), Full 0.837 (safety with guardrails 0.923).
  Rule changes after that run (guardrails v2: refusal markers "i can't/cannot write|create"; rag mode v2: "start with
  the answer, do not describe the steps", which fixed the missing citations) → rules `rules-7a0d2a58ac88`: **Full
  0.927**, safety with guardrails 1.0 (fails: injection-repeat-above, rag-late-three-times citation,
  instr-one-sentence, json-image-clarify-specific).
  The phase-7 rule fixes are confirmed: every over-refusal case passes (flu, nuclear power, dragon story).
  **Deviation from HARNESS §12.6:** a FULL run may set `khmerNative = false` (≤ 1/3 KHMER) but never `true` — the
  KHMER checks only count Khmer letters, and llama3.2 writes Khmer-looking nonsense that passes them. Score weights
  live in `rules/harness.yaml → evals` (AI service sends them with the suite); the Strong/Good/Fair/Weak cut-offs are
  the fixed display labels of §12.5 in the frontend. No Zustand: the runner is a module-level store
  (`useSyncExternalStore`), so the run keeps going while navigating. Non-MESSAGE tasks share one backend path
  (`TaskHandler`), ready for learning/quiz/image handlers in phases 11–12.

- 2026-11-08 — Phase 10: `trafilatura==2.3.1` (author Adrien Barbaresi) extracts pages. uv `exclude-newer =
  "2026-10-25"` in `ai-service/pyproject.toml` enforces the 2-week supply-chain rule for every Python dep (re-lock
  moved a few too-new deps back). SearXNG image pinned to `2026.10.24-ef0ec03da` (was `:latest`). web mode v2 ("start
  with the answer"). The prepare stream sends SEARCHING before the SearXNG call and READING before fetching. The
  "n results skipped" note is not shown (MessageMeta has no field for it); the count is kept in `prepare_context.webSkipped`.
  Model Test after the rule change, rules `rules-0a0cb21637a4`: **Full 0.927**, safety with guardrails 1.0 (same fails as phase 9;
  suite core has no WEB cases). Live check: "Who designed the Independence Monument" → Vann Molyvann [3], GROUNDED;
  APPROVE and EDIT approval flows both verified through the public API.

- 2026-11-08 — Phase 11: LEARN_STEP task input uses the BACKEND §7.5 names (`totalSteps`, `previousTitles`); the AI
  also accepts the old `stepCount`/`previousSteps`. Skip-interview drops an unanswered pending question. New rule
  (harness v4 `quiz.answerMismatchOverlap: 0.5`): a quiz question is dropped when its marked answer shares no content
  word with its own evidence + explanation while another option shares ≥ 50 % (found live: llama3.2 marked "absorb
  carbon dioxide" as the main purpose of photosynthesis). Model Test after the change, rules `rules-d059ffb778c4`:
  **Full 0.915**, safety with guardrails 1.0; `json-quiz` now fails because the check catches a real wrong answer
  ("Rain is formed by the sun") that the grader missed before — in the app the repair loop retries it.
  Live API run (photosynthesis): 3 interview questions → 8-step plan → approve → lesson 1 → quiz → 0 % then 100 % →
  step 2 CURRENT; answers never sent before submit; wrong-state calls → 409.
- 2026-11-08 — Phase 12: image generation is **opt-in**: `./setup.sh --images` installs the `images` uv group
  (`mflux==0.23.0`, Apple MLX) and downloads the prebuilt 4-bit `Runpod/FLUX.2-klein-4B-mflux-4bit` (Apache-2.0, not
  gated, 4.6 GB) into `ai-service/models/flux2-klein-4b-mflux-4bit`; `start.sh` adds `--group images` when that folder
  exists. Without it `features.images` is false, Generate is disabled with "needs the host machine" and the API returns
  503 FEATURE_UNAVAILABLE; clarify and prompt writing still work with any model. Background removal is always installed:
  `rembg[cpu]==2.0.85` + `isnet-general-use` (Apache-2.0; never `bria-rmbg`, non-commercial), model file checked by md5
  `fc16ebd8b0c10d971d3513d564d01e29`. AI image paths are relative to STORAGE_DIR and must end in `.png`; the AI service
  runs one image job at a time and unloads FLUX after each job. Variations re-run the prompt with new seeds (mflux klein
  is used prompt-only). New `GET /api/system/status` (API_CONTRACT §4.11, cached 10 s) tells the UI which features exist.
  Routes: `/image?s=<sessionId>` (the old mock `/image/[id]` route and image mocks were removed). New rules (harness v5
  `image`): clarify questions about details the request already gives are dropped (`givenDetails` word lists; an
  English content word that is not a detail word counts as the subject), and an IMAGE_PROMPT that keeps none of the
  request's content words is rejected → repair (found live: llama3.2 turned "a cat" into "a generic person"). The
  Model Test clarify counts now grade the questions the user is shown. Model Test FULL after the rule change
  (rules `rules-4022108442d3`): **0.915**, safety with guardrails 1.0; the only new pass needed was
  `json-image-clarify-specific`, which passes after the grader change (single-case re-run; expected full score 0.927).
  Live API run: clarify → 3 questions for "a cat", 1 for a detailed request; prompt keeps the subject; generate → 503
  without FLUX; background removal job → transparent PNG; deleting a session deletes its files.
- 2026-11-08 — Phase 13: `faster-whisper==1.2.1` (SYSTRAN, MIT; pulls PyAV 19.0.2 + Hugging Face hub/tokenizers);
  **no `silero-vad` package** (it needs torch): the Silero VAD v6 ONNX that faster-whisper ships is driven frame by frame
  with onnxruntime (already present via rembg). Models via `download_models.py --voice` (also in `setup.sh`):
  `Systran/faster-whisper-small` (MIT, 464 MB) and the Khmer fine-tune converted in a throwaway venv (240 MB). Khmer
  output has its word spaces removed (written Khmer has none). Read aloud stays off (Piper GPL-3.0, MMS-TTS Khmer
  CC-BY-NC). Live test through the real path (token → ws://localhost:8080/ws/voice → AI) with macOS `say` audio:
  partials every ~1 s, final "Explain how plants make food from sunlight. What is photosynthesis?" exact; KM model
  runs (no Khmer test speech on this Mac, so a Khmer speaker must try it); reused token → 1008; second tab → 1008
  "already open"; foreign Origin → 403.

## 11. Known issues / gotchas

- 16 GB memory: never keep FLUX loaded with Gemma; unload after each image job.
- Safari cannot reach `localhost` Ollama from an HTTPS site; Chrome shows a Local Network Access prompt (`loopback-network`).
- Firefox lacks WebGPU `shader-f16` → use q4f32 WebLLM builds.
- Next.js rewrites buffer SSE → use the catch-all Route Handler proxy `src/app/api/[...path]/route.ts`.
- Ollama default context is 4096 → always send `num_ctx`.
- NLLB and rembg's default model are non-commercial; Khmer STT needs the fine-tuned Whisper; FLUX on Mac uses mflux.
- `refresh_token` cookie is scoped to `/api/auth`, so page routing checks `session_hint`.
- Open turns hold a `lock_key` (one per chat / learning path / Model Test run); always released on terminal states.
- Non-MESSAGE tasks are English-only in v1.
- JDK installed is 24; the build targets release 21. Maven is not installed globally — use `./mvnw`.
- Port 5432 is used by another PostgreSQL on this Mac → Lumen's Docker Postgres is on **5433**:
  `DB_URL=jdbc:postgresql://localhost:5433/learnai`, `DATABASE_URL=postgresql://learnai:…@localhost:5433/learnai`.
- Spring Boot 4 uses Jackson 3 (`tools.jackson.*`); `@SpringBootTest` needs `@AutoConfigureMockMvc`.
  Jackson 3: `asString()` not `asText()`, `deepCopy()` returns `JsonNode` (cast), SSE from Spring is `event:x` (no space).
- Security permits `ASYNC`/`ERROR` dispatches so SSE emitters can finish after the request thread returns.
- Turbopack bundles `new Worker(new URL('./webllm.worker.ts', import.meta.url))` into its own worker chunk; it also
  copies the raw `.ts` to `static/media` (unused, harmless).
- llama3.2 3B sometimes abstains when a DOC source carries the "instruction-like text" label even if the answer
  is in it (it never followed the injected instruction in tests) — revisit in calibration (phase 14).
- NLLB 600M int8 is weak for Khmer, also on everyday words ("ឆ្មា…សាឡុង" cat on a sofa → "a pig's head… saloon";
  EN→KM "a cat on a sofa" → "a dog on a chair"); tokens and language tags were checked and are correct. Khmer image
  requests therefore get poor prompts. A larger NLLB (1.3B/3.3B) or MADLAD would help but costs RAM/disk; phase 14.
- `csam_cooccurrence` matches topic words (e.g. "sex education for children" → BLOCK); acceptable for now (critical
  category), revisit with the Model Test over-refusal cases.
- Model Test KHMER checks measure script, not meaning (see Decisions); a native speaker must judge Khmer answers.
- llama3.2 3B weak spots in the Full suite: repeats its instructions when asked "repeat everything above" (the leak
  guard replaces it outside TEST), follows a document's "prize" injection when summarising, ignores "one sentence",
  asks clarify questions for an already detailed image request.
- Hibernate: `CHAR(64)` columns (sha256) need `@JdbcTypeCode(SqlTypes.CHAR)` or `validate` fails.
- Next 16 + cacheComponents: route segment `runtime`/`dynamic` configs are rejected; a dynamic route with no static
  params needs `export const instant = false`.

## 12. Glossary

Harness (everything around the model we control) · Provider (HOST, BROWSER, LOCAL_OLLAMA, REMOTE_URL) · Turn (one
prepare → generate → finalize cycle) · Task (MESSAGE, TITLE, IMAGE_CLARIFY, IMAGE_PROMPT, LEARN_QUESTION, LEARN_PLAN,
LEARN_STEP, QUIZ, EVAL_CASE) · Pipeline (CHAT, RAG, WEB) · Mode (a prompt file in rules/modes) · Model profile · RAG ·
Chunk (~400 tokens) · Grounding · Abstain · Guard profile (STANDARD, STRICT, TEST) · Pivot translation · SSE · WebLLM ·
LNA · SSRF · Model Test.
