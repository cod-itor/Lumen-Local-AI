# Lumen — Local AI Learning Assistant

A private study partner whose AI runs on your own machine, in Khmer and English: chat with sources, ask your own
documents, generate images and follow learning paths — with a model harness (rules, guardrails, grounding checks and a
Model Test) around whichever model you use.

| Folder | What |
|---|---|
| `frontend/` | Next.js app (UI) |
| `backend/` | Spring Boot API — auth, data, turn orchestration |
| `ai-service/` | Python FastAPI — harness core, retrieval, models |
| `rules/` | Prompts, guardrails, model catalog, Model Test suite |
| `docs/` | Full specification |

## Run it locally (macOS)

Requirements: Docker Desktop, Ollama, JDK 21+, Python (via `uv`), Node 20+.

```bash
docker compose up -d postgres searxng
ollama pull llama3.2 && ollama pull embeddinggemma
```
Then start the AI service, the backend and the frontend — exact commands are in `CLAUDE.md` §5.

The project is non-commercial (it uses the NLLB translation model, licensed CC-BY-NC).
