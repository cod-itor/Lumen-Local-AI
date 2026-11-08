# Lumen — Local AI Learning Assistant

A private study partner whose AI runs on your own machine, in Khmer and English. Chat with sources, ask your own
documents, search the web with approval, follow learning paths with quizzes, make images and talk instead of typing —
with a model harness (rules, guardrails, grounding checks and a Model Test) around whichever model you choose.

| Tab / page | What it does |
|---|---|
| Chat | Answers with the model you picked; optional web search (SearXNG) with sources and "ask before searching" |
| Documents | Upload PDF / DOCX / TXT / Markdown; answers cite the pages they came from, or say they couldn't find it |
| Learn | Short interview → learning plan you approve → lessons → quizzes (≥ 70 % unlocks the next step) |
| Image | Clarifying questions → a better prompt you approve → images (FLUX.2 klein, optional) → background removal |
| Voice | Mic button in every composer: live English / Khmer transcription |
| Model Test (`/test`) | Scores any model inside the harness (safety, injection, documents, tools, JSON, Khmer) |
| Settings | Models (host, in-browser WebLLM, your own Ollama, a remote URL), language, privacy |

## Requirements

macOS on Apple Silicon (built and tested on an M1 Pro with 16 GB), about 15 GB of free disk (+6 GB for images),
[Docker Desktop](https://www.docker.com/products/docker-desktop/), [Ollama](https://ollama.com/download),
JDK 21+ (`brew install --cask temurin@21`), [uv](https://docs.astral.sh/uv/) (`brew install uv`) and Node 20+.

## Set up and run

```bash
./setup.sh            # once: .env files with fresh secrets, Postgres + SearXNG, Ollama models, Python/Java/Node
                      # builds, translation + voice + background-removal models
./setup.sh --images   # optional: also install image generation (FLUX.2 klein 4B, 4-bit, ~6 GB)
./start.sh            # starts everything; open http://localhost:3000 — Ctrl+C stops it (logs in logs/)
```

Sign up in the app; accounts whose email is listed in `ADMIN_EMAILS` (backend `.env`) are admins. Without `--images` the Image tab
still writes prompts but shows "Image generation needs the host machine" instead of generating.

| Service | Port |
|---|---|
| Frontend (Next.js) | 3000 |
| Backend (Spring Boot, Swagger at `/swagger-ui.html`) | 8080 |
| AI service (FastAPI, internal only) | 8001 |
| Postgres (pgvector) | 5433 |
| SearXNG | 8888 |
| Ollama | 11434 |

## Layout

| Folder | What |
|---|---|
| `frontend/` | Next.js app (UI) |
| `backend/` | Spring Boot API — auth, data, turn orchestration, jobs, voice relay |
| `ai-service/` | Python FastAPI — harness core, retrieval, guardrails, translation, images, speech |
| `rules/` | Prompts, guardrails, thresholds, model catalog, Model Test suite (the only place they live) |
| `docs/` | Full specification (`API_CONTRACT.md` = API source of truth, `HARNESS.md` = AI behaviour) |
| `CLAUDE.md` | Working notes: architecture, commands, decisions log, known issues |

## Tests and tools

```bash
cd backend && ./mvnw test
cd ai-service && uv run pytest && uv run ruff check .
cd frontend && npx tsc --noEmit && npx eslint src && npx next build
cd ai-service && uv run python scripts/validate_rules.py                       # rules/ checks
cd ai-service && uv run python scripts/run_evals.py --mode QUICK|FULL           # Model Test on the host model
cd ai-service && uv run python scripts/calibrate.py --retrieval --support --tokens   # threshold calibration
```

Change anything in `rules/` → run the Model Test and note the score in `CLAUDE.md` → Decisions.

## Good to know

- Everything stays on this machine. Safari can't reach a local Ollama; use Chrome or Edge for "your own Ollama" and
  in-browser models (WebGPU). Never set `OLLAMA_ORIGINS=*`.
- Khmer quality depends on small local models (NLLB 600M translation, a Whisper fine-tune); a native speaker should
  review Khmer answers before relying on them.
- Non-commercial only: NLLB (CC-BY-NC-4.0) is used for translation. Background removal uses `isnet-general-use`
  (Apache-2.0), FLUX.2 klein 4B is Apache-2.0, Whisper models are MIT / Apache-2.0.
