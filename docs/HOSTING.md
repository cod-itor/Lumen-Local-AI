# HOSTING.md — Hosting Options (not decided yet)

> **Status: proposal.** The owner has not chosen where to host. **Do not build deployment scripts or pick a provider until the owner decides.**
> Keep everything deployable anywhere: Docker images, configuration only through env variables, no hard-coded URLs.
> Record the decision in CLAUDE.md → Decisions.

---

## 1. Key facts that shape hosting

1. **No GPU is needed on the server** when visitors use their own models (BROWSER or LOCAL_OLLAMA). The server only runs the AI service in the `lite` profile (embeddings, ingestion, retrieval, web evidence, translation, guardrails, speech-to-text, background removal) plus the backend, database and frontend.
2. **The site needs a stable HTTPS domain.** Visitors put our origin into their Ollama settings (`OLLAMA_ORIGINS`); if the address changes, every visitor must redo the setup. Random tunnel URLs are not acceptable once real visitors use "Connect my Ollama".
3. **One origin for everything:** `https://<domain>/` serves the Next.js app; its Route Handler proxies `/api/*` to the backend; `/ws/voice` must be routed by the reverse proxy straight to the backend (WebSockets don't pass through the Route Handler).
4. **Shared storage:** the backend and AI service must see the same `STORAGE_DIR` (same machine or a shared volume).

### 1.1 Approximate memory (measure on the real setup)
| Component | RAM |
|---|---|
| Next.js (`next start`) | 0.2–0.5 GB |
| Spring Boot backend | 0.5–1 GB |
| PostgreSQL + pgvector | 0.3–1 GB |
| Ollama + EmbeddingGemma | ~0.6–1 GB |
| AI service `lite` (NLLB int8, Whisper small int8, rembg isnet) | 1–2.5 GB when all loaded (idle unload after 10 min) |
| SearXNG | ~0.2 GB |
| **Total (lite server)** | **~4–6 GB → choose 8 GB** |
| `full` profile adds: Gemma 4 E2B (~4–5 GB), FLUX.2 klein (4–8 GB while generating) | needs the MacBook or a GPU machine |

---

## 2. Options

### Option 1 — MacBook + Cloudflare Tunnel (cheapest; good for demos and the class presentation)
```
Internet ─HTTPS─► Cloudflare ─tunnel─► MacBook
                                        ├─ Next.js :3000  (Route Handler → backend :8080)
                                        ├─ Spring Boot :8080  (also /ws/voice)
                                        ├─ Postgres + SearXNG (Docker)
                                        └─ AI service (full) + Ollama (native)
```
- **Cost:** free (+ a domain, a few dollars per year).
- **How:** install `cloudflared`; create a named tunnel; ingress rules: `<domain>/ws/*` → `http://localhost:8080`, everything else → `http://localhost:3000`.
- **Pros:** zero server cost; HOST models and image generation available; nothing to migrate.
- **Cons:** offline whenever the laptop sleeps; home upload speed; the laptop's 16 GB shared between server and models.

### Option 2 — One 8 GB VPS running everything except the big models (recommended for always-on)
```
Internet ─HTTPS─► VPS (Docker Compose)
                   ├─ Caddy (automatic HTTPS): /ws/* → backend:8080, everything else → frontend:3000
                   ├─ frontend (next start), backend, postgres (pgvector), searxng
                   ├─ ollama (embeddinggemma only), ai-service (AI_PROFILE=lite)
                   └─ volume: storage/
```
- **Size:** 8 GB RAM, 2–4 vCPU, 60+ GB disk. Budget providers typically charge roughly US$5–15/month for this size (check current prices). Student credits (e.g. GitHub Student Developer Pack, Azure for Students) or free tiers (e.g. Oracle Cloud Always Free ARM) may cover it — check current availability.
- **Pros:** always online, one `docker compose up`, same origin, cheap.
- **Cons:** no host chat model or image generation (visitors use their own models; image tab shows "needs the host machine"); you maintain updates, backups and security.

### Option 3 — Managed services split up
Frontend on Vercel, backend on a container host (Render/Railway/Fly.io), Postgres on Neon or Supabase (both offer pgvector), AI service `lite` on another container host. Less administration, but: several dashboards, free tiers that sleep, SSE and WebSocket limits on some platforms, shared storage becomes object storage (needs code changes), costs add up. Check each provider's current limits before choosing.

### Option 4 — Hybrid (later)
Option 2 for the site + the MacBook connected as an extra HOST model provider (a future "connector" component), so visitors also get Gemma 4 and image generation when the laptop is online. Most flexible, most work; out of scope for now.

---

## 3. Recommendation
1. **Now:** Option 1 with a stable domain — free, full features, enough for testing with friends and the presentation.
2. **When it must be always on:** Option 2 (8 GB VPS, `lite` profile).
3. **Later:** Option 4 if you want your own models available to visitors again.

---

## 4. Production checklist (any option)
- [ ] Stable domain with HTTPS; `PUBLIC_URL`, `NEXT_PUBLIC_APP_ORIGIN`, `NEXT_PUBLIC_WS_URL` set to it.
- [ ] Reverse proxy routes `/ws/` to the backend; everything else to Next.js.
- [ ] `SPRINGDOC_ENABLED=false` (or Swagger restricted to admins).
- [ ] Strong `JWT_SECRET`, `AI_SERVICE_TOKEN`/`INTERNAL_TOKEN`, `PROVIDER_KEY_SECRET`, database password; `.env` files never committed.
- [ ] Postgres, AI service, Ollama and SearXNG reachable only on the internal Docker network / localhost.
- [ ] Firewall: only 80/443 (+ SSH with keys on a VPS).
- [ ] Rate limits and quotas active (API_CONTRACT §3.3).
- [ ] Daily `pg_dump` + `storage/` backup copied off the machine; restore tested once.
- [ ] Uptime monitor on `/actuator/health` and the AI service `/health` (through an internal check).
- [ ] `docker-compose.prod.yml` with `restart: unless-stopped` and health checks.
- [ ] Verified Cambodian emergency numbers in `guardrails.yaml`; Khmer texts reviewed.
- [ ] Privacy note on the landing page: browser/local models never send prompts to us; chat history is stored on our server; web search sends the query to search engines.
- [ ] License review if anything changes from non-commercial use (NLLB, MMS-TTS, Piper are not suitable for commercial use as configured).
