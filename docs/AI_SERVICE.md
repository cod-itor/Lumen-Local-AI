# AI_SERVICE.md — Python AI Service (harness core + model runtime)

> **Read first:** `OVERVIEW.md`, `HARNESS.md` (what the steps must do), `GUARDRAILS.md`, `RULES.md`.
> This service implements every AI step: input checks, routing, tools, retrieval, web evidence, prompt building,
> server-side generation, output checks, grounding verification, structured-output validation, Model Test grading,
> document ingestion, translation, image generation, background removal and speech-to-text.
> Only the backend calls it (internal network, header `X-Internal-Token`). It writes only the `chunks` table and files under `STORAGE_DIR`.

---

## 1. Profiles

`AI_PROFILE=full` (MacBook / GPU machine) or `lite` (CPU server). Each feature can be forced with an env flag.

| Feature | Env flag | `full` default | `lite` default | Needs |
|---|---|---|---|---|
| Host chat model (HOST provider) | `FEATURE_HOST_CHAT` | on | off | Ollama chat model |
| Embeddings, ingest, retrieval | always on | on | on | Ollama embedding model |
| Web search | `FEATURE_WEB_SEARCH` | on | on | SearXNG |
| Translation (NLLB) | `FEATURE_TRANSLATION` | on | on | CTranslate2 model files |
| Voice (speech-to-text) | `FEATURE_VOICE` | on | on | faster-whisper models |
| Images (generate, variations) | `FEATURE_IMAGES` | on | off | FLUX.2 [klein] 4B |
| Background removal | `FEATURE_BG_REMOVAL` | on | on | rembg (CPU) |
| Text-to-speech | `FEATURE_TTS` | off | off | Piper / MMS-TTS (license notes §11.3) |
| Injection classifier | `GUARD_INJECTION_CLASSIFIER` | off | off | Prompt Guard 2 (HF login) |
| Content classifier | `GUARD_CONTENT_CLASSIFIER` | off | off | `llama-guard3:1b` in Ollama |

A disabled feature's endpoints return `503 {"code":"FEATURE_UNAVAILABLE"}`. `GET /capabilities` reports the effective flags.

**On macOS run Ollama and this service natively (not in Docker)** so they can use the Apple GPU.

---

## 2. Stack

| Concern | Choice (verified Nov 2026) |
|---|---|
| Python | 3.12 (3.11+ works) |
| Web | FastAPI, Uvicorn, `sse-starlette` (SSE with ping) |
| Ollama | `ollama` Python client (`AsyncClient`) — native `/api/chat` and `/api/embed` |
| HTTP | `httpx` (async; web fetch, SearXNG, REMOTE_URL) |
| DB | `psycopg[binary,pool]` 3 + `pgvector` (Python adapter, `register_vector_async`) |
| Validation | Pydantic v2, `pydantic-settings`, `jsonschema` (draft 2020-12) |
| Rules | `PyYAML` |
| Documents | `pymupdf` (PDF), `python-docx` (DOCX) |
| Web extraction | `trafilatura` 2.x |
| Khmer text | `khmercut` (Apache-2.0) for word segmentation in grounding checks |
| Translation | `ctranslate2` 4.x + `transformers` tokenizer + `sentencepiece` (NLLB-200 distilled 600M, int8) |
| Speech | `faster-whisper` 1.2.x (CTranslate2, CPU int8), `silero-vad` 6.x |
| Images | macOS: `mflux` (MLX, 4/8-bit FLUX.2 klein); Linux/NVIDIA: `diffusers` ≥ 0.42 (`Flux2KleinPipeline`) + `torch` |
| Background removal | `rembg[cpu]` 2.0.x with an explicit model (§10.2) |
| Guard classifier | `transformers` + `torch` (CPU) for Prompt Guard 2 |
| Tooling | `uv`, `ruff`, `pytest`, `pytest-asyncio`, `respx` (HTTP mocks) |

---

## 3. Project structure

```
ai-service/
├── pyproject.toml
├── .env.example
├── app/
│   ├── main.py                 # FastAPI app, lifespan (load rules, models, DB pool), routers, auth dependency
│   ├── config.py               # Settings (pydantic-settings) — §12
│   ├── auth.py                 # X-Internal-Token check (constant-time compare)
│   ├── errors.py               # ServiceError(code, message, status) + handlers → {"code","message"}
│   ├── db.py                   # async connection pool, register_vector_async
│   ├── rules/
│   │   ├── loader.py           # load + validate rules/ (RULES.md §2), rulesVersion
│   │   ├── models.py           # Pydantic models of mode files, harness.yaml, guardrails.yaml, models.yaml
│   │   └── render.py           # strict {{VAR}} rendering
│   ├── harness/
│   │   ├── prepare.py          # P3–P13 orchestration, yields SSE events
│   │   ├── finalize.py         # F1–F15
│   │   ├── normalize.py        # HARNESS.md §4.1
│   │   ├── language.py         # detection, pivot helpers
│   │   ├── router.py           # pipeline + intents (HARNESS.md §5)
│   │   ├── tools.py            # calculator + datetime (HARNESS.md §6.1–6.2)
│   │   ├── history.py          # history clean/cut/cap (HARNESS.md §7.5 steps 4–6)
│   │   ├── budget.py           # token estimate + budget (§7.1–7.2)
│   │   ├── prompt_builder.py   # exact layout (§7.7)
│   │   ├── params.py           # §7.6
│   │   ├── grounding.py        # verifier (§10.2), specific-facts detector
│   │   ├── structured.py       # JSON extraction, schema + semantic checks, repair messages
│   │   ├── loops.py            # loop detector (§8.4)
│   │   └── profiles.py         # model profile resolution (HARNESS.md §2.2)
│   ├── guard/
│   │   ├── engine.py           # check_input / check_output / check_untrusted (GUARDRAILS.md §5)
│   │   ├── prompt_guard.py     # Prompt Guard 2 classifier (optional)
│   │   ├── llama_guard.py      # Llama Guard 3 via Ollama (optional)
│   │   ├── markdown_policy.py  # images, HTML, link allowlist (GUARDRAILS.md §7.1)
│   │   └── url_safety.py       # SSRF validator + pinned-IP fetch (GUARDRAILS.md §9)
│   ├── rag/
│   │   ├── parsing.py  cleaning.py  chunking.py  ingest.py
│   │   ├── embeddings.py       # prefixes, batching
│   │   └── retrieval.py        # vector + lexical + RRF + selection
│   ├── web/
│   │   ├── searxng.py  fetch.py  extract.py  evidence.py
│   ├── models/
│   │   ├── ollama_runtime.py   # chat stream, embed, keep_alive, semaphore
│   │   ├── remote_runtime.py   # OpenAI-compatible streaming for REMOTE_URL
│   │   ├── translator.py       # NLLB via CTranslate2 + markdown-safe translation
│   │   ├── images.py           # mflux / diffusers backends
│   │   ├── bg_removal.py       # rembg session
│   │   ├── stt.py              # faster-whisper + Silero VAD streaming
│   │   ├── tts.py              # optional
│   │   └── manager.py          # lazy load + idle unload of HF/CT2 models
│   ├── evals/
│   │   ├── suites.py           # load rules/evals/suites/*.yaml
│   │   ├── fixtures.py         # in-memory fixture corpus (chunk + embed at startup)
│   │   └── graders.py          # HARNESS.md §12.3 checks
│   └── api/                    # routers: health, capabilities, models, harness, generate, translate, rag,
│                               #          images, voice, guard, evals, rules
├── scripts/
│   ├── download_models.py      # HF downloads + CTranslate2 conversions (§12.2)
│   ├── validate_rules.py       # RULES.md §7 step 2
│   ├── run_evals.py            # run a suite against a provider through the internal API
│   └── calibrate.py            # HARNESS.md §13.2
└── tests/                      # mirrors app/
```

---

## 4. Internal API (called only by the backend)

All requests need `X-Internal-Token: <INTERNAL_TOKEN>` (else 401). JSON bodies use camelCase (Pydantic `alias_generator=to_camel`, `populate_by_name=True`). Errors: HTTP status + `{"code": "...", "message": "..."}`. SSE events: `event: <name>` + one-line JSON `data`, ping every 15 s.

### 4.1 Overview
| Method | Path | Type | Purpose |
|---|---|---|---|
| GET | `/health` | JSON | `{status:"ok", ollama:bool, db:bool, profile}` |
| GET | `/capabilities` | JSON | `{profile, features:{hostChat, images, bgRemoval, voice, tts, translation, webSearch, guardClassifier}, hostChatModels[], defaultChatModel, embedModel, embedDim, rulesVersion}` |
| GET | `/status` | JSON | `{loadedModels:[{name,sizeMb}], queue:{heavyJobsQueued, heavyJobRunning, serverTurnsActive, serverTurnsQueued}}` |
| POST | `/rules/reload` | JSON | `{rulesVersion, loadedAt}` or 422 `{code:"RULES_INVALID", errors:[...]}` (old rules stay active) |
| GET | `/models/catalog` | JSON | `{host:{available, models[]}, browser:{models: BrowserModelDto[]}, ollamaSuggestions[]}` from `models.yaml` |
| POST | `/models/profile` | JSON | `{kind, model, overrides}` → `ModelProfile` |
| POST | `/harness/prepare` | SSE | §4.2 |
| POST | `/generate` | SSE | §4.3 |
| POST | `/harness/finalize` | JSON | §4.4 |
| POST | `/translate` | JSON | `{text, source:"EN"\|"KM", target:"EN"\|"KM"}` → `{text}` |
| POST | `/guard/check` | JSON | `{text, kind:"TEXT"\|"IMAGE_PROMPT", profile}` → `{action, categories[], rule, refusal:{EN,KM}, guardEvents[]}` |
| POST | `/guard/check-url` | JSON | `{url, purpose:"REMOTE_URL"}` → `{ok, reason}` |
| POST | `/rag/ingest` | SSE | §13 |
| DELETE | `/rag/documents/{documentId}` | JSON | `{deleted: n}` |
| GET | `/evals/suites` | JSON | `[{id, version, quickCount, fullCount, categories[]}]` |
| GET | `/evals/suites/{id}` | JSON | `{id, version, cases:[{id, category, quick, task}]}` |
| POST | `/images/generate` | SSE | §10.1 |
| POST | `/images/variations` | SSE | §10.1 |
| POST | `/images/remove-background` | JSON | §10.2 |
| WS | `/voice/stream` | WebSocket | §11 (same protocol as API_CONTRACT §6.8) |
| POST | `/voice/tts` | audio/wav | §11.3 |

### 4.2 `POST /harness/prepare` (SSE)
Request (`PrepareRequest`):
```json
{
  "turnId": "uuid", "task": "MESSAGE", "attempt": 1,
  "user": { "id": "uuid", "timezone": "Asia/Phnom_Penh", "now": "2026-11-08T03:15:00Z",
            "outputLanguage": "EN", "answerLength": "NORMAL", "temperature": null, "guardProfile": "STANDARD",
            "askBeforeSearch": false },
  "provider": { "kind": "BROWSER", "model": "Qwen3.5-2B-q4f16_1-MLC", "profile": {} },
  "chat": { "id": "uuid", "tab": "DOCS", "documentIds": ["uuid"] },
  "input": { "content": "How much is the late fee?", "webSearch": false, "approvedQuery": null },
  "history": [ { "role": "user", "content": "..." }, { "role": "assistant", "content": "..." } ],
  "previousUserMessage": "...",
  "taskInput": null
}
```
`provider.profile` is the resolved `ModelProfile` (HARNESS.md §2.2; shown empty here). `history` holds the branch after HARNESS.md §7.5 steps 1–3 (complete pairs in model language, at most 40 messages); `harness/history.py` applies steps 4–6 (clean, cut, per-pipeline cap) before the budget. `previousUserMessage` is used by the router's follow-up detection and by the RAG/WEB query building (HARNESS.md §7.3 step 1, §7.4 step 1). `user.askBeforeSearch` decides whether WEB stops for approval (HARNESS.md §3.4).

Events (in order of possible occurrence):
| Event | Data |
|---|---|
| `status` | `{stage, detail?}` |
| `sources` | `SourceItem[]` = API `SourceDto` + `text` (full chunk text used in the prompt) + `chunkEmbeddingAvailable` |
| `tools` | `ToolResultDto[]` |
| `needs_approval` | `{query, context}` |
| `blocked` | `{action:"BLOCK"\|"SUPPORT", categories[], content, originalContent, translations, guardEvents[], context}` |
| `abstained` | `{reason:"NO_DOCUMENTS"\|"NO_RELEVANT_CHUNKS"\|"NO_WEB_RESULTS"\|"WEB_UNAVAILABLE", content, originalContent, translations, suggestions[], context}` |
| `prepared` | `{messages[], params, outputSchema, modelProfile, clientGuard, context, guardEvents[]}` |
| `error` | `{code, message, retryable}` |

`context` = `PrepareContext` (HARNESS.md §3.8): `{pipeline, inputLanguage, outputLanguage, answerLanguage, modelInput, sources[], tools[], routing:{intents[], notes[], suggestions[]}, inputGuard:{action, categories[], injectionSuspected, wouldAction}, params, outputSchemaId, promptHash, rulesVersion, evalCaseId?, metrics:{estimatedPromptTokens, topSim, chunksUsed, abstainedBeforeModel}}`. `context` is also included in `blocked` and `abstained`, so the backend can write metrics for every turn.
`guardEvents[]` items: `{stage, action, categories[], rule, excerpt, profile}` (masked excerpt; the backend stores them).
In `blocked` and `abstained`, `content`, `originalContent` and `translations` are filled from the prepared EN/KM texts in `guardrails.yaml` (never machine translation) exactly like a finalized answer: MESSAGE follows the API_CONTRACT §4.4 Language rule (KM → `content` = KM, `originalContent` = EN; BOTH → `content` = EN, `translations.KM`; EN → `content` = EN); other tasks get `content` in Khmer when `user.outputLanguage = KM`, else English.

### 4.3 `POST /generate` (SSE) — SERVER generation for HOST and REMOTE_URL
Request: `{turnId, target:{kind:"HOST"\|"REMOTE_URL", model, baseUrl?, apiKey?}, messages[], params, outputSchema?, modelProfile, clientGuard}`.
Events: `queued {position}` (only while waiting for a free generation slot: sent at once, then every 10 s); `token {text}` (visible text only, reasoning removed); `done {content, finishReason, stats:{ttftMs, tokensPerSec, outputTokens, promptTokens, totalMs, model}}`; `error {code, message, retryable}`.
If the backend disconnects, the generator is cancelled (`asyncio.CancelledError` propagates to the Ollama/httpx stream, which closes the connection).

### 4.4 `POST /harness/finalize` (JSON)
Request: `{turnId, task, attempt, user, provider, context, taskInput, output:{content, finishReason, stats}}`.
Response (`FinalizeResponse`):
```json
{
  "status": "COMPLETED",
  "content": "The late fee is 500 riel per book per day [1].",
  "originalContent": null,
  "translations": {},
  "grounding": { "level": "GROUNDED", "supportedRatio": 1.0, "sentences": [], "removedUrls": 0, "removedCitations": 0, "hasSpecificFacts": false },
  "guard": { "action": "ALLOW", "categories": [], "profile": "STANDARD", "wouldAction": null },
  "suggestions": [],
  "finishReason": "STOP",
  "data": null,
  "errors": [],
  "repairMessages": [],
  "evalResult": null,
  "guardEvents": [],
  "metrics": { "groundingLevel": "GROUNDED", "supportedRatio": 1.0, "guardOutputAction": "ALLOW", "jsonAttempts": 1 },
  "attemptsLeft": null
}
```
Field notes:
- `status`: `COMPLETED` | `BLOCKED` | `SUPPORT` | `ABSTAINED` | `SCHEMA_INVALID` | `EMPTY`.
- `content`: the final display text after every fix (HARNESS.md §9). `originalContent`: the model's text before the language pivot, or `null`.
- `data`: the validated structured result for JSON tasks (and `{ "title": "…" }` for TITLE); `null` for MESSAGE.
- `errors` and `repairMessages`: filled when `status` is `SCHEMA_INVALID` (HARNESS.md §9.1) or `EMPTY` (one repair message, HARNESS.md §8.5).
- `attemptsLeft`: for `SCHEMA_INVALID` and `EMPTY` = `generation.jsonMaxAttempts − attempt` (0 = give up); `null` otherwise. The backend follows it and never hard-codes the limit.
- For `EVAL_CASE` the status is always `COMPLETED` (no retries; the grade is in `evalResult`).
- For `TITLE` an empty or unusable output is not retried: status `COMPLETED` with `data = {"title": null}`.
- `BLOCKED`/`SUPPORT` for non-MESSAGE tasks: `content` = the prepared refusal/support text in Khmer when `user.outputLanguage = KM`, else English (F13 does not run for these tasks).
- `evalResult`: only for the `EVAL_CASE` task (`EvalResultDto`, API_CONTRACT.md).

---

## 5. Rules loading and rendering

- On startup and `/rules/reload`: load every file of `RULES_DIR` (RULES.md §1), validate (RULES.md §2), compile all regexes (`re.IGNORECASE | re.UNICODE`), load JSON Schemas with `jsonschema.Draft202012Validator.check_schema`, load eval suites and build the in-memory fixture corpus (`evals/fixtures.py`: chunk and embed every file in `rules/evals/fixtures/` once; HARNESS.md §12.2).
- `rulesVersion` = `"rules-" + sha256(concatenation of all rule file paths and bytes in sorted order)[:12]`.
- Rendering (`render(template, vars)`): replace `{{NAME}}`; any remaining `{{…}}` → error (`RULES_RENDER_ERROR`, a bug).
- The loaded rules object is immutable; reload swaps the reference atomically (in-flight requests keep the old one).

---

## 6. Model runtime

### 6.1 Ollama (`ollama_runtime.py`)
- `AsyncClient(host=OLLAMA_HOST)`.
- **Chat stream:** `client.chat(model, messages, stream=True, options={temperature, top_p, min_p, num_predict, num_ctx, repeat_penalty, stop, seed}, format=<schema or None>, think=<False when profile.disableThinking == OLLAMA_THINK_FALSE else omitted>, keep_alive=OLLAMA_KEEP_ALIVE)`. Read `chunk.message.content` (ignore `chunk.message.thinking`); last chunk has `done=True`, `done_reason`, `eval_count`, `eval_duration` (ns), `prompt_eval_count`.
- **Embeddings:** `client.embed(model=OLLAMA_EMBED_MODEL, input=[...], truncate=True, keep_alive=OLLAMA_KEEP_ALIVE)` → `embeddings` (L2-normalized, 768 floats). Batch size 32. Verify `len == EMBED_DIM` at startup (embed "ping"); mismatch → refuse to start.
- **Concurrency:** `asyncio.Semaphore(serverParallelTurns)` for generations (FIFO); while a `/generate` request waits for it, emit `queued {position}` at once and every 10 s. Embeddings are not limited beyond Ollama's own queue.
- **Warm-up:** at startup send a 1-token chat and a 1-input embed so the first user request is fast.
- Ollama defaults to a 4096-token context on machines with < 24 GB VRAM; the harness always sends `num_ctx` explicitly.

### 6.2 Remote OpenAI-compatible (`remote_runtime.py`) — REMOTE_URL
`POST {baseUrl}/v1/chat/completions` through the URL-safety client (§8.5) with `Authorization: Bearer <apiKey>`, body `{model, messages, stream: true, stream_options: {include_usage: true}, temperature, top_p, max_tokens, stop, seed, response_format}` where `response_format = {"type": "json_schema", "json_schema": {"name": "<schemaId>", "schema": <schema>}}` for JSON tasks. Parse `data:` lines until `data: [DONE]`. If the server rejects `response_format` (HTTP 400), retry once without it (the prompt already asks for JSON). Timeout 120 s total.

### 6.3 Streaming post-processing (both runtimes)
1. Remove reasoning from the stream: maintain a state machine over the accumulated text for `<think>…</think>` and Gemma 4 thought channels (`<|channel>thought … <channel|>`): text inside is not emitted.
2. Apply stop strings to the visible text (some runtimes ignore them in JSON mode).
3. Run the loop detector (§8.4 of HARNESS.md) every 200 new characters → stop with `LOOP_STOP`.
4. Run `clientGuard.stopPatterns` → stop with `GUARD_STOP`.
5. Stop at `maxOutputChars`.
6. Measure `ttftMs` from request start to first visible character.

### 6.4 Model manager (`manager.py`)
Lazy-loads non-Ollama models on first use (translator, whisper models, Prompt Guard, rembg session, image pipeline), records last use, and every 60 s unloads models idle longer than `IDLE_UNLOAD_MINUTES` (default 10). The image pipeline additionally unloads right after a job when `IMAGE_UNLOAD_AFTER_JOB=true` (default on machines with ≤ 16 GB RAM). `GET /status` lists loaded models.

---

## 7. Prepare implementation (`harness/prepare.py`)

Implements HARNESS.md §4 exactly. Notes per step:

### 7.1 Normalization and language
`normalize.py` + `language.py` as HARNESS.md §4.1 and §6.3. Khmer letters = U+1780–U+17FF and U+19E0–U+19FF. Keep U+17D2 (COENG, invisible subscript marker) — it is part of Khmer spelling.

### 7.2 Embedding prefixes (EmbeddingGemma model card, exact strings)
| Use | Text sent to `/api/embed` |
|---|---|
| Retrieval query (RAG/WEB) | `task: search result \| query: {text}` |
| Document chunk (ingest) | `title: {filename without extension, or "none"} \| text: {chunk text}` |
| Web chunk | `title: {page title or "none"} \| text: {chunk text}` |
| Answer sentence (grounding) | `task: search result \| query: {sentence}` |
Changing the embedding model requires a new migration if the dimension changes (`vector(768)`), re-ingest of all documents, and re-calibration (HARNESS.md §13.2).

### 7.3 Retrieval SQL (`rag/retrieval.py`)
Vector search — **exact** cosine search on the user's selected documents (fast for per-chat corpora; no approximate-index recall loss):
```sql
WITH cand AS MATERIALIZED (
  SELECT id, document_id, page, ordinal, start_char, end_char, text, text_en, language,
         injection_suspected, embedding
  FROM chunks
  WHERE source = 'DOC' AND user_id = %(user_id)s AND document_id = ANY(%(doc_ids)s)
)
SELECT id, document_id, page, ordinal, start_char, end_char, text, text_en, language,
       injection_suspected, 1 - (embedding <=> %(q)s) AS sim
FROM cand
ORDER BY embedding <=> %(q)s
LIMIT %(k)s;
```
Lexical search (English queries only; `tsv` indexes `coalesce(text_en, text)`, so Khmer documents are searchable through their English translation):
```sql
SELECT c.id, ts_rank_cd(c.tsv, q) AS rank
FROM chunks c, websearch_to_tsquery('english', %(text)s) q
WHERE c.source = 'DOC' AND c.user_id = %(user_id)s AND c.document_id = ANY(%(doc_ids)s) AND c.tsv @@ q
ORDER BY rank DESC
LIMIT %(k)s;
```
Fusion and selection in Python per HARNESS.md §7.3 (RRF k = 60). With two query embeddings (original Khmer + English pivot), run the vector query twice and fuse all lists. Load the stored `embedding` of selected chunks for the grounding check (keep in `SourceItem`, not sent to the backend; the backend stores only text — finalize re-reads embeddings by chunk id: `SELECT id, embedding FROM chunks WHERE id = ANY(%(ids)s)`).

### 7.4 Untrusted text in prompts
Selected chunks pass through `guard.engine.check_untrusted` decisions stored at ingest (`injection_suspected`): DOC → header suffix; WEB → dropped (GUARDRAILS.md §5.2).

### 7.5 Web evidence (`web/*`)
- **SearXNG:** `GET {SEARXNG_URL}/search?q=<query>&format=json&language=en&safesearch=<1|2>&categories=general` (timeout 6 s). JSON format must be enabled in SearXNG `settings.yml`: `search: formats: [html, json]` (else 403). Use `results[]` fields `title`, `url`, `content`, `engine`, `score`, optional `publishedDate`.
- **Fetch:** `fetch.py` uses the URL-safety client (§8.5); accept `text/html`, `application/xhtml+xml`, `text/plain`; decode with the response charset (fallback UTF-8 with replacement).
- **Extract:** `trafilatura.extract(html, url=url, output_format="json", with_metadata=True, include_comments=False, include_tables=True, include_links=False, include_images=False, favor_precision=True)` → JSON with `text`, `title`, `date`, `sitename`. Drop if `len(text) < 200`.
- **Rank/pack/cache:** HARNESS.md §7.4. Cache key `url_hash = sha256(normalized url)`; reuse rows with `fetched_at > now - 24h`. A background task deletes WEB chunks older than 24 h every hour.
- SearXNG unreachable → `abstained {reason: WEB_UNAVAILABLE}`.

### 7.6 Tools, router, budget, prompt, params
`tools.py`, `router.py`, `history.py`, `budget.py`, `prompt_builder.py`, `params.py` implement HARNESS.md §5–§7 with the values in `rules/harness.yaml` (`history.py`: §7.5 steps 4–6 with `budgets.historyMaxMessages` and `budgets.historyMessageMaxChars`). The calculator parser is an `ast`-based whitelist evaluator (HARNESS.md §6.1) — **`eval`/`exec` are banned in this code base (ruff rule S307)**.

### 7.7 Eval cases
For `task = EVAL_CASE`, `taskInput = {suite, caseId}`: load the case; build the prompt as its `task`/`pipeline` would, but RAG retrieval uses the in-memory fixture corpus of the case's `documents` (top 3, no gate), profile TEST, seed 42, `answerLanguage` override. `context.evalCaseId` is set so finalize grades it.
A case's `taskInput` uses exactly the shapes the backend sends for that task (BACKEND.md §7.5: TITLE `{conversation: {user, assistant}}`, LEARN_QUESTION `{goal, answered, askedTopics}`, LEARN_PLAN `{goal, answers}`, QUIZ `{lesson, count}`, IMAGE_CLARIFY `{request}`, IMAGE_PROMPT `{request, answers, style?}`), with one convenience: `lessonFixture: <file in rules/evals/fixtures/>` is replaced by `lesson: <that file's text>` when the suite is loaded.

---

## 8. Finalize implementation (`harness/finalize.py`)

Implements HARNESS.md §9 (F1–F15) in order. Notes:

### 8.1 Sentence splitting and words
- Sentences: split on `(?<=[.!?។៕])\s+` and newlines; bullet/numbered list items are sentences; merge citation-only fragments into the previous sentence.
- English words: `re.findall(r"[A-Za-z][A-Za-z'-]*|\d+(?:[.,:]\d+)*", text)`; Khmer words: `khmercut.tokenize(text)` on Khmer runs.
- Stopwords: a fixed English list of ~180 words (`app/harness/stopwords_en.txt`, e.g. the NLTK English list) — numbers are never stopwords.

### 8.2 Grounding verifier
`grounding.py` implements HARNESS.md §10.2. Embeddings: one batch call for all factual sentences (query prefix); chunk embeddings come from the DB (DOC) or are recomputed for WEB chunks (cached in memory per turn id for 15 min). Cosine = dot product (vectors are normalized). Sentence offsets are computed **last**, on the final model-language text (after the citation repairs of step 9 and the tool line of F12 — the text saved as `originalContent`, or as `content` when nothing was translated): split that text again with the step-3 splitter and give report sentence *i* the span of final sentence *i* (repairs only add or change citation markers inside a sentence, so the order and count do not change; an appended `**Exact result:**` line is just an extra sentence at the end). Convert Python code-point indexes to UTF-16 code units: `utf16 = len(text[:i].encode("utf-16-le")) // 2`.

### 8.3 Structured outputs
`structured.py` implements HARNESS.md §9.1 and the semantic checks of RULES.md §5, then builds `repairMessages` (API_CONTRACT §6.4). Quiz evidence check uses `difflib.SequenceMatcher(None, a, b).ratio()` on normalized strings.

### 8.4 Translation of results
Uses `models/translator.translate_markdown` (§9.2 below). Refusals, abstain texts and disclaimers use the prepared EN/KM strings from `guardrails.yaml`, never machine translation.

### 8.5 URL-safety client (`guard/url_safety.py`)
`async def safe_request(method, url, purpose, **kw)`: validate (GUARDRAILS.md §9 steps 1–3), then connect to the validated IP: build the request URL with the IP literal, set the `Host` header to the original host, and pass `extensions={"sni_hostname": host}` so TLS uses and verifies the original hostname. Follow redirects manually (max 3), validating each hop. Enforce size and time limits while streaming the body.

### 8.6 Eval grading
`evals/graders.py` implements HARNESS.md §12.3 on the text after F1–F3 and returns `EvalResultDto` (`checks[]` with `name`, `passed`, `detail`), `guardWouldBlock` = input `wouldAction ∈ {BLOCK, SUPPORT}` or output `wouldAction ∈ {REPLACE, SUPPORT}`.

---

## 9. Translation (`models/translator.py`)

### 9.1 Model
- `facebook/nllb-200-distilled-600M`, codes `eng_Latn` and `khm_Khmr`, converted to CTranslate2 int8:
```bash
ct2-transformers-converter --model facebook/nllb-200-distilled-600M --output_dir models/nllb-200-distilled-600M-int8 --quantization int8
```
- Usage:
```python
import ctranslate2, transformers
translator = ctranslate2.Translator("models/nllb-200-distilled-600M-int8", device="cpu", compute_type="int8")
tok = transformers.AutoTokenizer.from_pretrained("facebook/nllb-200-distilled-600M", src_lang="eng_Latn")  # khm_Khmr for KM→EN
tokens = [tok.convert_ids_to_tokens(tok.encode(s)) for s in sentences]
results = translator.translate_batch(tokens, target_prefix=[["khm_Khmr"]] * len(tokens), beam_size=4, max_decoding_length=256)
out = [tok.decode(tok.convert_tokens_to_ids(r.hypotheses[0][1:])) for r in results]   # drop the language token
```
- Inputs above ~200 tokens are split at commas/semicolons before translation (the model was trained on ≤ 512 tokens; shorter segments translate better).
- **License:** NLLB-200 is CC-BY-NC-4.0 (non-commercial, research model). Fine for a student/non-commercial project; a commercial deployment must switch to a permissive model (e.g. MADLAD-400 3B, Apache-2.0, heavier) and re-evaluate Khmer quality.

### 9.2 `translate_markdown(text, src, tgt)`
HARNESS.md §6.3 algorithm. Cache results in memory (LRU 2000 entries, key = sha256(text)+src+tgt).

---

## 10. Images and background removal

### 10.1 FLUX.2 [klein] 4B (`models/images.py`)
- Model: `black-forest-labs/FLUX.2-klein-4B` (Apache-2.0, distilled: **4 steps, guidance 1.0**; guidance > 1 is ignored by the distilled model).
- **macOS (Apple Silicon):** use `mflux` with 8-bit quantization (≈ 8 GB loaded) or 4-bit (≈ 4.3 GB; prebuilt `Runpod/FLUX.2-klein-4B-mflux-4bit`). Follow the installed mflux version's README for the FLUX.2 klein class (`Flux2Klein` with `ModelConfig.flux2_klein_4b()` and `quantize=4|8` at the time of writing).
- **Linux + NVIDIA:** `diffusers` `Flux2KleinPipeline.from_pretrained("black-forest-labs/FLUX.2-klein-4B", torch_dtype=torch.bfloat16)`, `pipe.enable_model_cpu_offload()`, `pipe(prompt=p, height=h, width=w, guidance_scale=1.0, num_inference_steps=4, generator=torch.Generator().manual_seed(seed)).images[0]`.
- `POST /images/generate` request: `{jobId, prompt, width, height, count (1–4), seed?, steps? (default 4, max 8 for distilled), outputPaths: [abs paths, one per image]}`. Acquire the image semaphore (1). Events: `progress {stage: "QUEUED"|"LOADING_MODEL"|"GENERATING", current, total}`; `done {images:[{path, width, height, seed, durationMs}], model}`; `error`.
- Seeds: given seed → seed, seed+1, …; none → random 31-bit per image.
- Prompt safety is checked by the backend before (`/guard/check` kind IMAGE_PROMPT) — this endpoint trusts its caller.
- **Variations:** `POST /images/variations` = same prompt with new seeds (always available). Reference-image editing is possible with FLUX.2 [klein] but is only enabled if the installed pipeline exposes an image-conditioning argument; otherwise variations stay prompt-based.
- Unload the pipeline after each job when `IMAGE_UNLOAD_AFTER_JOB=true`.

### 10.2 Background removal (`models/bg_removal.py`)
- `rembg` **with an explicit model**: `new_session("isnet-general-use")` (Apache-2.0 source) or `"birefnet-general"` (MIT). **Do not use rembg's current default `bria-rmbg`** — its weights are CC BY-NC 4.0.
- `POST /images/remove-background {inputPath, outputPath}` → `remove(input_bytes, session=session)` → save PNG with alpha → `{outputPath, width, height}`.

---

## 11. Voice

### 11.1 Models
- English (and auto): `faster-whisper` `small`, `device="cpu"`, `compute_type="int8"` (Apple Silicon runs on CPU via Accelerate; there is no Metal backend).
- Khmer: base Whisper is not usable for Khmer (reported character error rate above 100% on FLEURS for large-v3). Use a Khmer fine-tune converted to CTranslate2, default `seanghay/whisper-small-khmer-v2` (Apache-2.0):
```bash
ct2-transformers-converter --model seanghay/whisper-small-khmer-v2 --output_dir models/whisper-small-khmer-ct2 --quantization int8 --copy_files tokenizer.json preprocessor_config.json
```
  Evaluate alternatives (e.g. `BuzzASR/khmer` large-v3, MIT — better but much heavier) with your own recordings before switching.
- VAD: `silero-vad` (`load_silero_vad(onnx=True)`, `VADIterator(model, threshold=0.5, sampling_rate=16000, min_silence_duration_ms=800, speech_pad_ms=100)`); chunks must be exactly 512 samples at 16 kHz.

### 11.2 `WS /voice/stream` protocol and algorithm
Protocol = API_CONTRACT §6.8. Per connection:
1. On `start`: choose the model (`KM` → Khmer model; `EN`/`AUTO` → English small; `AUTO` uses Whisper language detection on the first 3 s and switches to the Khmer model if `km` is detected with probability ≥ 0.5). Send `ready`.
2. For each 512-sample frame: feed `VADIterator`; while in speech, append to the utterance buffer.
3. Every ~1 s of new speech: transcribe the current buffer (`beam_size=1`, `vad_filter=False`, `condition_on_previous_text=False`) → send `partial`.
4. On speech end (VAD end event) or `stop`: transcribe the full buffer (`beam_size=5`) → send `final {text, language}` → reset the buffer.
5. Limits: 60 s per utterance (force `final`), 5 min per connection (close 1008). One transcription at a time per connection; at most 2 connections transcribing at once service-wide (semaphore), others get `error {code: "VOICE_BUSY"}`.

### 11.3 TTS (optional, off by default)
`POST /voice/tts {text, lang}` → WAV. EN: Piper (`piper-tts`, maintained repo `OHF-Voice/piper1-gpl`, **GPL-3.0**; voice licenses vary per voice — check each voice's model card). KM: `facebook/mms-tts-khm` via `transformers` `VitsModel` (**CC-BY-NC-4.0**). Enable only for non-commercial use and after reviewing licenses.

---

## 12. Configuration and setup

### 12.1 `ai-service/.env.example`
```
HOST=127.0.0.1
PORT=8001
INTERNAL_TOKEN=change-me                      # equals backend AI_SERVICE_TOKEN
AI_PROFILE=full                               # full | lite
APP_NAME=Study Assistant
DATABASE_URL=postgresql://learnai:change-me@localhost:5432/learnai
RULES_DIR=../rules
STORAGE_DIR=../storage                        # same folder as the backend's STORAGE_DIR
MODELS_DIR=./models
PUBLIC_URL=http://localhost:3000              # used in the web fetch User-Agent

OLLAMA_HOST=http://localhost:11434
OLLAMA_CHAT_MODEL=gemma4:e2b-it-qat
OLLAMA_EMBED_MODEL=embeddinggemma
OLLAMA_KEEP_ALIVE=30m
EMBED_DIM=768

SEARXNG_URL=http://localhost:8888

TRANSLATION_MODEL_DIR=./models/nllb-200-distilled-600M-int8
TRANSLATION_TOKENIZER=facebook/nllb-200-distilled-600M

WHISPER_EN_MODEL=small
WHISPER_KM_MODEL_DIR=./models/whisper-small-khmer-ct2

IMAGE_BACKEND=mflux                           # mflux | diffusers
IMAGE_MODEL=black-forest-labs/FLUX.2-klein-4B
IMAGE_QUANTIZE=8                              # mflux: 4 or 8
IMAGE_UNLOAD_AFTER_JOB=true
REMBG_MODEL=isnet-general-use

GUARD_INJECTION_CLASSIFIER=false
PROMPT_GUARD_MODEL=meta-llama/Llama-Prompt-Guard-2-22M
HF_TOKEN=                                     # needed to download gated models (Prompt Guard 2, EmbeddingGemma on HF)
GUARD_CONTENT_CLASSIFIER=false
GUARD_CONTENT_MODEL=llama-guard3:1b

IDLE_UNLOAD_MINUTES=10
LOG_PROMPTS=false
```
Feature flags (`FEATURE_*`, §1) may be added to override profile defaults.

### 12.2 One-time setup
```bash
ollama pull gemma4:e2b-it-qat && ollama pull embeddinggemma        # + llama-guard3:1b if the content classifier is on
cd ai-service && uv sync
python scripts/download_models.py   # NLLB → CT2 int8, Khmer Whisper → CT2, rembg model, (optional) Prompt Guard 2, FLUX.2 klein
python scripts/validate_rules.py
uvicorn app.main:app --host 127.0.0.1 --port 8001
```
SearXNG (Docker): image `searxng/searxng`, port mapping `8888:8080`, mounted `settings.yml` containing:
```yaml
use_default_settings: true
server: { secret_key: "change-me", limiter: false, public_instance: false }
search: { formats: [html, json], safe_search: 1 }
```

---

## 13. Ingestion (`rag/ingest.py`) — `POST /rag/ingest` (SSE)

Request: `{documentId, userId, path, mime, filename}`. Events: `progress {stage: "PARSING"|"TRANSLATING"|"EMBEDDING"|"SAVING", current, total}`, `done {pages, chunkCount, language}`, `error {code, message}` with codes `SCANNED_PDF`, `EMPTY_DOCUMENT`, `TOO_MANY_PAGES`, `PARSE_FAILED`, `EMBED_FAILED`.

1. **Parse:** PDF → `pymupdf` per page `page.get_text("text")`; > 300 pages → `TOO_MANY_PAGES`. If ≥ 50% of pages have < 30 characters → `SCANNED_PDF` ("This PDF has no selectable text; OCR is not supported"). DOCX → paragraphs in order plus tables (cells joined by ` | `, one line per row); one logical page (`page = null`). TXT/MD → UTF-8 text, one logical page.
2. **Clean** (per page): remove lines that occur on ≥ 50% of pages when there are ≥ 4 pages (headers/footers, page numbers); join hyphenated line breaks (`(\w)-\n(\w)` → `\1\2`); join single newlines inside paragraphs with a space (keep blank lines and list lines); normalize (HARNESS.md §4.1). Write the cleaned page text to `STORAGE_DIR/users/{userId}/documents/{documentId}/pages/{n}.txt` (n = 1-based; `1.txt` for single-page formats). Offsets of chunks refer to these files.
3. **Language:** document language = detect(full text) (HARNESS.md §6.3).
4. **Chunk** (`rag/chunking.py`): per page, split into paragraphs (blank lines), then sentences (EN: `(?<=[.!?])\s+(?=[A-Z0-9"“(])`; KM: after `។ ៕ ? !`). Pack sentences greedily up to `chunking.targetTokens` (400 estimated tokens). The next chunk starts with the trailing sentences of the previous one totalling ≤ `overlapTokens` (60). Chunks never cross pages. A sentence longer than the target is split at word boundaries (Khmer: `khmercut` tokens). A final chunk below `minChunkTokens` (40) is merged into the previous chunk of the same page. Record `start_char`, `end_char`, `ordinal`, `page`, chunk `language`.
5. **Translate** chunks whose language is `KM` or `MIXED` to English (`text_en`) in batches (progress `TRANSLATING`). Skipped if translation is unavailable (then `text_en = NULL`).
6. **Injection score** each chunk (GUARDRAILS.md §5.2) → `injection_suspected`.
7. **Embed** `text` with the document prefix (§7.2) in batches of 32 (progress `EMBEDDING`).
8. **Save** in one transaction: `DELETE FROM chunks WHERE document_id = %s`, then batched inserts (`executemany`, 100 rows/batch).
9. Return `done`.

`DELETE /rag/documents/{id}` → `DELETE FROM chunks WHERE document_id = %s` → `{deleted}` (the files are deleted by the backend).

---

## 14. Testing and acceptance

**Unit:** normalization (control tokens, invisible chars, Khmer ZWSP rule); language detection; router intents (every pattern + negatives); calculator (precedence, percent, sqrt, division by zero, huge numbers, refuses `__import__`/names/attributes); date tools; budget (drops Example, trims history pairs); prompt layout snapshot tests for every mode; markdown policy; URL safety (GUARDRAILS.md §12, item 4); grounding verifier (citations valid/invalid/auto-fix/auto-cite, number and quote checks, levels); structured parsing and every semantic check; loop detector; eval graders (every check type).

**Integration (Postgres with pgvector in Docker, Ollama mocked by `respx` or a tiny fake server):** ingest a fixture PDF → chunks with offsets matching `pages/*.txt`; retrieval returns the expected chunk for each RAG eval question; prepare for every task returns valid `prepared` payloads; finalize returns GROUNDED for a correct cited answer and flags a wrong number.

**Live smoke (real Ollama):** `python scripts/run_evals.py --suite core --mode QUICK --provider host` passes ≥ 80% with the default host model; record the score in CLAUDE.md.

**Acceptance:** `scripts/validate_rules.py` passes; `/capabilities` matches the profile; `prepare` → `generate` → `finalize` end to end for HOST in under 2 s to first token on the dev Mac (warm model).
