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
├── frontend/                  Next.js 16 app (built UI; being wired to the API)
├── backend/                   Spring Boot 4.1 monolith — package com.learnai (BACKEND.md §2) [phase 1+]
├── ai-service/                Python FastAPI — package app (AI_SERVICE.md §3) [phase 2+]
└── storage/                   shared files (git-ignored)
```
`Document-Support/` at the root is the owner's original research package; it is git-ignored (copied into docs/ + rules/).

### Frontend (`frontend/`)
- Next.js 16.x (App Router, Turbopack, `cacheComponents`), React 19, TypeScript strict, Tailwind v4, shadcn (base-nova /
  Base UI), motion, next-themes (dark default), react-hook-form + zod. **npm** (not pnpm).
- i18n: own store (`src/i18n/` — `useMessages`, `useLocale`, `setLocale`, `Localized<T>`), EN + KM. Not next-intl.
- Data today: `src/mocks/*` behind `src/services/*` (server-only). Wiring replaces services with `lib/api.ts` calls.
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
| AI service | Python 3.12 via uv, FastAPI, sse-starlette, ollama client, httpx, psycopg 3 + pgvector, Pydantic v2, jsonschema, PyYAML, pymupdf, python-docx, trafilatura, khmercut, ctranslate2, faster-whisper, silero-vad, mflux, rembg |
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
cd ai-service && uv sync && uv run python scripts/download_models.py   # TODO phase 2/8/12/13
uv run python scripts/validate_rules.py                                # TODO phase 2
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001               # TODO phase 2
cd backend && cp .env.example .env && ./mvnw spring-boot:run           # Flyway migrates on start (fill JWT_SECRET etc.)
open http://localhost:8080/swagger-ui.html
cd frontend && npm install && npm run dev                              # http://localhost:3000
```
Tests: `cd backend && ./mvnw test` · `cd ai-service && uv run pytest` · `cd frontend && npx tsc --noEmit && npx eslint src && npx next build`.
Evals/calibration: `uv run python scripts/run_evals.py`, `uv run python scripts/calibrate.py` (TODO phases 9/14).

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
| 2 | AI service skeleton + rules loader | next |
| 3 | Harness CHAT (HOST) | todo |
| 4 | Frontend wiring | todo |
| 5 | Client providers (WebLLM, local Ollama) | todo |
| 6 | Documents (RAG) + grounding | todo |
| 7 | Guardrails | todo |
| 8 | Translation + tools | todo |
| 9 | Model Test | todo |
| 10 | Web search | todo |
| 11 | Learning paths + quizzes | todo |
| 12 | Images | todo |
| 13 | Voice | todo |
| 14 | Calibration + polish | todo |

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
- 2026-11-08 — Stack fixed by the spec and confirmed by the owner: AI service = Python FastAPI, backend = Spring Boot.

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

## 12. Glossary

Harness (everything around the model we control) · Provider (HOST, BROWSER, LOCAL_OLLAMA, REMOTE_URL) · Turn (one
prepare → generate → finalize cycle) · Task (MESSAGE, TITLE, IMAGE_CLARIFY, IMAGE_PROMPT, LEARN_QUESTION, LEARN_PLAN,
LEARN_STEP, QUIZ, EVAL_CASE) · Pipeline (CHAT, RAG, WEB) · Mode (a prompt file in rules/modes) · Model profile · RAG ·
Chunk (~400 tokens) · Grounding · Abstain · Guard profile (STANDARD, STRICT, TEST) · Pivot translation · SSE · WebLLM ·
LNA · SSRF · Model Test.
