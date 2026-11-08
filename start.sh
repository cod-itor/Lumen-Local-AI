#!/usr/bin/env bash
# Start everything; Ctrl+C stops it. Logs are in logs/. Open http://localhost:3000
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs
docker info >/dev/null 2>&1 || { open -a Docker; until docker info >/dev/null 2>&1; do sleep 2; done; }
docker compose up -d postgres searxng >/dev/null
ollama list >/dev/null 2>&1 || { open -a Ollama; until ollama list >/dev/null 2>&1; do sleep 2; done; }

pids=()
trap 'echo; echo "Stopping…"; kill "${pids[@]}" 2>/dev/null; wait; exit 0' INT TERM
(cd ai-service && exec uv run uvicorn app.main:app --host 127.0.0.1 --port 8001) > logs/ai.log 2>&1 & pids+=($!)
(cd backend && exec java -jar target/*.jar) > logs/backend.log 2>&1 & pids+=($!)
(cd frontend && exec npx next start -p 3000) > logs/frontend.log 2>&1 & pids+=($!)

printf "Starting"; until curl -sf localhost:8080/actuator/health >/dev/null && curl -sf -o /dev/null localhost:3000/login; do
  printf "."; sleep 2
  for p in "${pids[@]}"; do kill -0 "$p" 2>/dev/null || { echo; echo "A service stopped — see logs/"; kill "${pids[@]}" 2>/dev/null; exit 1; }; done
done
echo; echo "Lumen is running → http://localhost:3000  (Ctrl+C to stop)"
wait
