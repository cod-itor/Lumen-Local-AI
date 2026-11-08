# Local AI Learning Assistant — Implementation Spec (v3, 2026-11-08)

This package is the full plan for the remaining work: **backend, AI service, the model harness and guardrails**, plus how
the already-built frontend connects to them. It is written so a developer or an AI coding agent can implement it directly.

## How to use it
1. Put the `.md` files in `docs/` of the repo, the `rules/` folder at the repo root, and copy `sql/V1__init.sql` to
   `backend/src/main/resources/db/migration/V1__init.sql`.
2. Give the agent `docs/OVERVIEW.md` first. `OVERVIEW.md` §8 tells the agent to read everything and create a comprehensive `CLAUDE.md`.
3. Build in the order of `OVERVIEW.md` §6.

## Message to paste into your coding agent
```
Read docs/OVERVIEW.md first and follow OVERVIEW.md §8: read every document in the listed order, look at the
existing frontend/ code, then create a comprehensive CLAUDE.md at the repo root. Treat docs/API_CONTRACT.md as the single
source of truth for the API and docs/HARNESS.md for AI behaviour. Implement in the build order of OVERVIEW.md §6,
one phase at a time; after each phase run its "done when" check and the tests listed in the relevant document,
then update CLAUDE.md (status + decisions). Do not change rules/ prompts or thresholds without running the Model
Test as described in docs/RULES.md §7. Ask me before deviating from the spec.
```

## Files
| File | What it covers |
|---|---|
| `OVERVIEW.md` | Product, architecture, verified models and licenses, build order, global rules, CLAUDE.md instructions, glossary |
| `API_CONTRACT.md` | **Single source of truth** for every public endpoint, DTO (TypeScript shapes), enum, error code, rate limit and SSE event |
| `HARNESS.md` | The core: providers and model profiles, turn lifecycle, prepare/finalize pipelines, router, calculator/date tools, context engineering, generation rules, grounding and anti-hallucination, structured tasks, Model Test |
| `GUARDRAILS.md` | Threat model, OWASP LLM Top 10 (2026) mapping, policy and actions, decision algorithms, injection defenses, output/link/image policy, SSRF validator, limits, logging |
| `RULES.md` | How the `rules/` files are loaded, rendered, validated and safely changed; prompt-writing rules for small models |
| `BACKEND.md` | Spring Boot 4.1 layered monolith: dependencies, packages and classes, config, security (JWT + refresh rotation, CSRF origin check, rate limits), DB, harness orchestration, task handlers, jobs, every service, tests |
| `AI_SERVICE.md` | Python FastAPI harness core: profiles, internal API, Ollama runtime, retrieval SQL, web evidence, finalize, translation (NLLB), images (FLUX.2 klein), background removal, voice (Whisper + Khmer model), ingestion, config, tests |
| `FRONTEND.md` | Integration of the built Next.js app: streaming proxy, API/SSE clients, WebLLM and Ollama providers (code), harness hook, client guard, rendering rules, screen-by-screen endpoints, Ollama setup guide and connection test, CSP, voice capture |
| `HOSTING.md` | Hosting options (not decided), memory estimates, recommendation, production checklist |
| `rules/` | System prompt, 11 mode prompts, 5 JSON Schemas, `harness.yaml`, `guardrails.yaml`, `models.yaml`, Model Test suite (48 cases, 22 quick) with fixtures |
| `sql/V1__init.sql` | Complete PostgreSQL schema (22 tables) |

## Key decisions in this version
- **One turn protocol for every model** (`POST /api/harness/turns`): prepare → generate (browser or server) → finalize. It replaces the earlier `POST /chats/{id}/messages`; regenerate, edit and retry use the same endpoint.
- **The AI service is the harness core** (all text analysis, prompts, guardrails, grounding, grading); the backend orchestrates, stores and enforces.
- **Every way a turn can end is defined once** (API_CONTRACT §6.4 "Turn outcomes"): what is saved, what the client receives, how Stop, cancel, retries, expiry and failures behave. Failed turns save no half-made messages, every status change is atomic, and open turns hold a lock (one per chat, learning path or Model Test run) that is always released.
- **Anti-hallucination by design:** retrieval gate abstains before the model when documents lack the answer; sentence-level grounding with number/quote/citation checks and auto-fixes; calculator and date tools with enforced results; humility rules; visible "Unverified" states.
- **Prompts written for 1–4B models:** short numbered rules, exact fallback sentences, one perfect example, data before the question, a Reminder after it, schema-constrained JSON with a repair loop.
- **Corrections from research:** Gemma 4 E2B is ~4.3 GB in Ollama (QAT tag), not ~1.5 GB; Next.js rewrites can buffer SSE → use a Route Handler proxy; rembg's default model is non-commercial → use `isnet-general-use`; base Whisper can't do Khmer → use a Khmer fine-tune; FLUX on Mac → mflux quantized; Safari cannot reach `localhost` Ollama from an HTTPS site.

## Verification done for this package
- `sql/V1__init.sql` executed on PostgreSQL 16 (pgvector type stubbed); constraints tested (one open turn per chat, chunk source rule).
- Every rules file passes the RULES.md loader checks; every example JSON in the mode files validates against its schema; every system message fits the token budget.
- All router, guardrail and log-masking regexes compile; the guardrail rules were run against the Model Test inputs.
- Every section reference and every `/api` path across the documents was cross-checked; every endpoint in `API_CONTRACT.md` has a caller in `FRONTEND.md`, and every DTO, enum value, error code and finish reason used anywhere is defined in `API_CONTRACT.md`.
- Every TypeScript, JSON, YAML and Python snippet parses.
- Two independent review passes read all documents against each other (30 and then 20 findings: contradictions, undefined edge cases, race conditions); every finding was fixed and the checks above were re-run.

## Open items (owner)
1. Add **verified** Cambodian emergency/crisis numbers to `rules/guardrails.yaml → support.emergencyLine` (left empty on purpose).
2. Native-speaker review of Khmer texts marked `# KM: review` and of the Khmer router patterns.
3. Run `calibrate.py` once the AI service works (retrieval and grounding thresholds are marked `[CALIBRATE]`).
4. Decide hosting (`HOSTING.md`).
