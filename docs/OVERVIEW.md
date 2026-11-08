# OVERVIEW.md — Local AI Learning Assistant (read this first)

> **What this package is:** the complete plan for the project. A developer (or an AI coding agent) should be able to build the
> remaining parts by implementing these documents, without redesigning anything.
> **Reading order:** this file → `API_CONTRACT.md` → `HARNESS.md` → `GUARDRAILS.md` → `RULES.md` → `BACKEND.md` → `AI_SERVICE.md` → `FRONTEND.md` → `HOSTING.md`.
> Supporting files: `rules/` (prompts, policies, model catalog, Model Test suite) and `sql/V1__init.sql` (database).

---

## 0. Status (2026-11-08)

| Part | Status |
|---|---|
| Frontend (Next.js UI) | **Built.** Remaining: connect to the API and add the harness pieces (`FRONTEND.md`) |
| Backend (Spring Boot) | To build (`BACKEND.md`) |
| AI service (Python) | To build (`AI_SERVICE.md`) |
| Harness, guardrails, rules | Specified (`HARNESS.md`, `GUARDRAILS.md`); rules written in `rules/` |
| Hosting | **Not decided.** Develop on the MacBook; see `HOSTING.md` for options |
| Open TODO before launch | Verified Cambodian emergency/crisis numbers (`rules/guardrails.yaml → support.emergencyLine`); native-speaker review of Khmer texts marked `# KM: review` |

---

## 1. What we are building

A ChatGPT-style learning assistant whose AI runs **locally**, with Khmer + English support, and a **model harness** around it:
- **Chat** — a study assistant; optional web search with sources (Perplexity-style right sidebar).
- **Documents** — upload PDFs/notes and ask questions; every answer cites and highlights the paragraph it came from.
- **Image** — clarify the idea, approve an improved prompt, generate images, remove backgrounds.
- **Learning paths** — the AI interviews the student, proposes a plan for approval, writes short lessons and quizzes, and tracks progress.
- **Voice input**, **Khmer ↔ English** answers, **human-in-the-loop** approvals.
- **Bring your own model** — visitors can run a model in their browser (WebLLM) or connect their own Ollama, and use it with our rules, guardrails, search and tests. **Model Test** scores any model inside the harness.

### Design laws (from HARNESS.md §0)
1. Evidence over memory. 2. Code decides, the model writes. 3. One small job per model call. 4. Same rules for every model. 5. Verify after generating. 6. Fail visibly.

---

## 2. Architecture

```
 Browser (Next.js app)
 │  /api/* through a Next.js Route Handler proxy (same origin, httpOnly JWT cookies, SSE streaming)
 │  CLIENT generation for BROWSER (WebLLM, WebGPU) and LOCAL_OLLAMA (http://localhost:11434) providers
 ▼
 Backend — Spring Boot 4.1 (Java 21) — orchestrator + system of record
 │  auth (JWT + refresh rotation), rate limits, turns (state machine), messages, documents, images, learning, Model Test runs
 │  relays SSE to the browser, applies validated results, Swagger UI
 ├──► PostgreSQL 16 + pgvector (all data; `chunks` for document/web search)
 ├──► Shared file storage (STORAGE_DIR: uploads, page texts, images)
 ▼  internal HTTP + SSE + WebSocket (X-Internal-Token)
 AI service — Python FastAPI — harness core + model runtime
 │  input normalization, guardrails, language pivot, router, calculator/date tools, retrieval, web evidence,
 │  prompt building from rules/, SERVER generation, output checks, grounding verifier, JSON validation, Model Test grading,
 │  ingestion, translation (NLLB), images (FLUX.2 klein), background removal (rembg), speech-to-text (Whisper)
 ├──► Ollama (host chat model, embedding model, optional Llama Guard)
 └──► SearXNG (self-hosted web search, optional)
```

| Who | Owns | Never does |
|---|---|---|
| Frontend | UI, client generation with the visitor's model, advisory client guard | Calls the AI service or our Ollama directly |
| Backend | Auth, data, turn lifecycle, persistence, limits, applying results | Builds prompts or judges text |
| AI service | All text analysis, prompts, checks, retrieval, generation for HOST/REMOTE, grading | Auth, users, writing any table except `chunks` |

Request flow summary: `POST /api/harness/turns` (SSE) → backend → AI `prepare` → either the browser generates and calls `/complete`, or the AI service generates (`/generate`) → AI `finalize` → backend saves → `done`. Details: `HARNESS.md` §3.

---

## 3. Models (verified 2026-11-08)

| Job | Model | Runtime | Size / notes | License |
|---|---|---|---|---|
| Host chat (HOST provider) | `gemma4:e2b-it-qat` (Gemma 4 E2B) | Ollama | ~4.3 GB; native system role; 128K max context (we use 8K) | Apache 2.0 |
| Embeddings | `embeddinggemma` (300M, 768-dim) | Ollama | 2K tokens input; fixed query/document prefixes | Gemma Terms of Use |
| Translation EN↔KM | NLLB-200 distilled 600M (CTranslate2 int8) | Python | small, CPU | **CC-BY-NC-4.0 (non-commercial)** |
| Images | FLUX.2 [klein] 4B | mflux (Mac, 4/8-bit) / diffusers (NVIDIA) | 4 steps; ~4–8 GB loaded quantized | Apache 2.0 |
| Background removal | rembg `isnet-general-use` (or `birefnet-general`) | Python CPU | do **not** use rembg's default `bria-rmbg` (CC BY-NC) | Apache 2.0 / MIT |
| Speech-to-text EN | faster-whisper `small` (int8, CPU) | Python | Apple Silicon runs on CPU | MIT |
| Speech-to-text KM | `seanghay/whisper-small-khmer-v2` → CTranslate2 | Python | base Whisper is unusable for Khmer | Apache 2.0 |
| Content safety (optional) | `llama-guard3:1b` | Ollama | ~1.6 GB; S1–S13; English | Llama 3.2 Community |
| Injection detection (optional) | Llama Prompt Guard 2 22M (or 86M) | Python CPU | 512 tokens; threshold 0.9 | Llama 4 Community |
| Groundedness (optional) | `granite3-guardian:2b` | Ollama | ~2.7 GB | Apache 2.0 |
| Visitor models (browser) | WebLLM catalog: Qwen 3.5 0.8B/2B/4B, Llama 3.2 1B, Qwen 2.5 1.5B, Gemma 4 E2B | WebLLM | see `rules/models.yaml` | per model |
| Visitor models (Ollama) | any; suggestions `qwen3.5:2b`, `qwen3.5:0.8b`, `qwen3:1.7b`, `gemma4:e2b-it-qat` | visitor's Ollama | | per model |

The project is non-commercial (student project). Before any commercial use, replace NLLB (e.g. MADLAD-400) and review every license again.

---

## 4. Repository structure

```
project-root/
├── CLAUDE.md                # memory file for AI coding agents (see §8)
├── docs/                    # this spec package: OVERVIEW, API_CONTRACT, HARNESS, GUARDRAILS, RULES, BACKEND, AI_SERVICE, FRONTEND, HOSTING
├── rules/                   # AI behaviour (no code) — see RULES.md
├── frontend/                # Next.js app (built)
├── backend/                 # Spring Boot monolith (src/main/resources/db/migration/V1__init.sql from sql/)
├── ai-service/              # Python FastAPI
├── storage/                 # shared files (git-ignored)
├── docker-compose.yml       # postgres (pgvector), searxng; backend optional
└── README.md
```
Never commit model weights, `.env` files, or `storage/`.

---

## 5. Running locally (MacBook M1 Pro, 16 GB)

Order: Docker services → Ollama → AI service → backend → frontend.
```bash
docker compose up -d postgres searxng
ollama pull gemma4:e2b-it-qat && ollama pull embeddinggemma
(cd ai-service && uv sync && python scripts/download_models.py && uvicorn app.main:app --port 8001)
(cd backend && ./mvnw spring-boot:run)
(cd frontend && pnpm dev)
```
Memory plan on 16 GB: always loaded = Gemma 4 E2B (~4–5 GB) + EmbeddingGemma (~0.6 GB) + NLLB int8 (small); on demand = FLUX.2 klein (unloaded after each job), Whisper. Ollama and the AI service run natively (not in Docker) to use the Apple GPU.

---

## 6. Build order

| # | Phase | Done when |
|---|---|---|
| 1 | Database + backend auth | Flyway V1 applied; register/login/refresh work in Swagger |
| 2 | AI service skeleton + rules loader | `/health`, `/capabilities`; `validate_rules.py` passes |
| 3 | Harness CHAT (HOST) | MESSAGE turn streams from Gemma through prepare → generate → finalize; message saved |
| 4 | Frontend wiring | Login, chat list, Chat tab end to end with HOST through the Route Handler proxy |
| 5 | Client providers | Chat works with BROWSER (WebLLM) and LOCAL_OLLAMA, same `meta` as HOST |
| 6 | Documents (RAG) + grounding | Upload → ingest → cited answers; abstain gate; grounding badges and underlines |
| 7 | Guardrails | GUARDRAILS.md decision tests pass 100%; output link/image policy on |
| 8 | Translation + tools | KM pivot both ways; calculator and date tools; TOOL_USE evals pass |
| 9 | Model Test | Quick suite runs for all provider kinds; scores ≥ 0.8 on the host model |
| 10 | Web search | SearXNG evidence with sources and approval flow |
| 11 | Learning paths + quizzes | Interview → plan approval → lessons → quizzes with evidence check |
| 12 | Images | Clarify → approve → generate → background removal |
| 13 | Voice | Live transcription EN/KM |
| 14 | Calibration + polish | `calibrate.py` thresholds recorded; red-team checklist; hosting per the owner's decision |

---

## 7. Global rules for everyone working on this project

1. `API_CONTRACT.md` is the single source of truth for public endpoints, DTOs, enums and events.
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

---

## 8. Instructions for AI coding agents (CLAUDE.md)

**Before writing code:**
1. Read every document in the reading order above, then look at the existing `frontend/` code.
2. **Create a very comprehensive `CLAUDE.md` at the repo root** (or update it). It is the persistent memory for future sessions and must let a new session work without re-reading every document. It must contain:
   - **Project summary:** purpose, tabs and features, the six design laws, the bring-your-own-model idea.
   - **Architecture:** the diagram and ownership table of §2; how the parts talk (REST, SSE events list, WebSocket, internal API with `X-Internal-Token`); the turn protocol in 10 lines (prepare → client/server generation → finalize → task handler) and the "Turn outcomes" table of API_CONTRACT §6.4 (what each ending saves and sends; failed, cancelled and expired MESSAGE turns save no assistant message).
   - **Repository map:** every top-level folder and the important subfolders (Java packages from BACKEND.md §2, Next.js routes and `lib/` modules from FRONTEND.md, Python modules from AI_SERVICE.md §3, every file in `rules/`).
   - **Tech stack with versions** and the model table of §3 with licenses.
   - **How to run:** exact commands for every service, model downloads and conversions, migrations, Swagger, tests, `validate_rules.py`, `run_evals.py`, `calibrate.py`. Mark anything not yet implemented as TODO; never invent commands.
   - **Environment variables:** every key of the three `.env.example` files with a one-line meaning, grouped by service.
   - **Conventions:** Java (layered packages, no `@Data` on entities, constructor injection, DTO records, MapStruct, Flyway-only schema changes, Swagger annotations), TypeScript (strict, API through `lib/api.ts`/`lib/sse.ts`, providers through `lib/providers/`), Python (type hints, Pydantic, async, ruff, no `eval`), error format and codes, SSE event names, commit message style.
   - **Hard rules:** §7 of this file.
   - **Current status:** which phase of §6 is in progress, what is done, what is next. Update at the end of every session.
   - **Decisions log:** dated entries (model changes, calibrated thresholds with values, Model Test scores per prompt version, hosting decision, deviations from this spec and why).
   - **Known issues / gotchas:** 16 GB memory budget; Safari cannot reach localhost Ollama; Firefox lacks WebGPU shader-f16 (q4f32 builds); Next.js rewrites buffer SSE (use the Route Handler); Chrome Local Network Access prompt (`loopback-network`); Ollama's default context is 4096 (always send `num_ctx`); NLLB is non-commercial; rembg default model is non-commercial; Khmer Whisper needs the fine-tuned model; FLUX on Mac uses mflux; the `refresh_token` cookie is scoped to `/api/auth`, so page routing checks `session_hint`; open turns hold a `lock_key` (one per chat / learning path / Model Test run); non-MESSAGE tasks are English-only in v1.
   - **Glossary:** §9.
3. Keep CLAUDE.md accurate: update it in the same change whenever architecture, commands, folders, env vars or the phase status change.
4. If the documents are unclear or contradict each other, `API_CONTRACT.md` wins for API shapes and `HARNESS.md` for AI behaviour; for anything else ask the owner and record the answer in CLAUDE.md → Decisions.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| Harness | Everything around the model we control: rules, guardrails, retrieval, tools, verification, history, grading |
| Provider | Where the model runs: HOST, BROWSER, LOCAL_OLLAMA, REMOTE_URL |
| Turn | One prepare → generate → finalize cycle (`harness_turns`); its ending is one of the "Turn outcomes" (API_CONTRACT §6.4) |
| Task | What a turn does: MESSAGE, TITLE, IMAGE_CLARIFY, IMAGE_PROMPT, LEARN_QUESTION, LEARN_PLAN, LEARN_STEP, QUIZ, EVAL_CASE |
| Pipeline | How a MESSAGE is answered: CHAT, RAG (documents), WEB |
| Mode | A prompt file in `rules/modes/` |
| Model profile | How to talk to a model family (context, system role, JSON, thinking, Khmer) |
| RAG | Retrieval-augmented generation: answer from retrieved document chunks |
| Chunk | ~400-token piece of a document (or ~300 of a web page) with its embedding |
| Grounding | Checking each sentence of an answer against its sources |
| Abstain | Saying "I couldn't find this…" instead of guessing |
| Guard profile | STANDARD, STRICT or TEST guardrail configuration |
| Pivot translation | Khmer → English for the model, English → Khmer for the user |
| SSE | Server-Sent Events (one-way streaming over HTTP) |
| WebLLM | Library running LLMs in the browser with WebGPU |
| LNA | Chrome's Local Network Access permission for sites reaching `localhost` |
| SSRF | Tricking a server into calling internal addresses |
| Model Test | Running the eval suite against a provider and showing a scorecard |
