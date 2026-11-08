#!/usr/bin/env bash
# One-time setup of Lumen on a new Mac. Safe to run again: it skips what is already done.
set -euo pipefail
cd "$(dirname "$0")"
# ./setup.sh --images also installs image generation (FLUX.2 klein 4B, 4-bit: ~4.6 GB + ~1 GB of libraries).
IMAGES=false; for a in "$@"; do [ "$a" = "--images" ] && IMAGES=true; done
[ -d ai-service/models/flux2-klein-4b-mflux-4bit/transformer ] && IMAGES=true
say() { printf "\n\033[1m▸ %s\033[0m\n" "$*"; }
need() { command -v "$1" >/dev/null || { echo "Missing: $1 — $2"; exit 1; }; }

say "Checking tools"
need docker "install Docker Desktop: https://www.docker.com/products/docker-desktop/"
need ollama "install Ollama: https://ollama.com/download"
need java   "install JDK 21+: brew install --cask temurin@21"
need uv     "install uv: brew install uv"
need npm    "install Node 20+: brew install node"
java -version 2>&1 | grep -Eq 'version "(2[1-9]|[3-9][0-9])' || { echo "JDK 21 or newer is required"; exit 1; }

say "Settings files (.env) with fresh secrets"
rand() { openssl rand -base64 "$1" | tr -d '\n'; }
TOKEN=$(rand 32 | tr -d '/+=')
if [ ! -f ai-service/.env ]; then sed "s|^INTERNAL_TOKEN=.*|INTERNAL_TOKEN=$TOKEN|" ai-service/.env.example > ai-service/.env; fi
if [ ! -f backend/.env ]; then
  T=$(grep '^INTERNAL_TOKEN=' ai-service/.env | cut -d= -f2 | awk '{print $1}')
  sed -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand 48 | tr -d '/+=')|" \
      -e "s|^AI_SERVICE_TOKEN=.*|AI_SERVICE_TOKEN=$T|" \
      -e "s|^PROVIDER_KEY_SECRET=.*|PROVIDER_KEY_SECRET=$(rand 32)|" backend/.env.example > backend/.env
fi
[ -f frontend/.env.local ] || cp frontend/.env.example frontend/.env.local

say "Database + web search (Docker)"
docker info >/dev/null 2>&1 || { open -a Docker; echo "Waiting for Docker…"; until docker info >/dev/null 2>&1; do sleep 2; done; }
docker compose up -d postgres searxng

say "Ollama models: llama3.2 (2.0 GB) + embeddinggemma (0.6 GB)"
ollama list >/dev/null 2>&1 || { open -a Ollama; until ollama list >/dev/null 2>&1; do sleep 2; done; }
ollama pull llama3.2
ollama pull embeddinggemma

say "AI service (Python)"
UVG=(); $IMAGES && UVG=(--group images)
(cd ai-service && uv sync --frozen ${UVG[@]+"${UVG[@]}"} && uv run ${UVG[@]+"${UVG[@]}"} python scripts/validate_rules.py >/dev/null)
say "Khmer translation model (one-time ~3 GB download, keeps 0.6 GB)"
(cd ai-service && uv run python scripts/download_models.py --translation)
say "Background removal model (isnet-general-use, 170 MB)"
(cd ai-service && uv run python scripts/download_models.py --background)
if $IMAGES; then
  say "Image generation model (FLUX.2 klein 4B, 4-bit, ~4.6 GB)"
  (cd ai-service && uv run --group images python scripts/download_models.py --images)
else
  echo "Image generation is off. Run ./setup.sh --images to install it (~6 GB)."
fi

say "Backend (Java)"
(cd backend && ./mvnw -q -DskipTests package)
say "Frontend (Next.js)"
(cd frontend && npm ci --no-audit --no-fund && npx next build)

say "Done. Start Lumen with ./start.sh"
