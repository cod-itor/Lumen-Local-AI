import type { RoadmapContent } from "@/types/roadmap";

export const mockRoadmap: RoadmapContent = {
  title: "Coming soon",
  intro:
    "Bigger ideas planned for Lumen. Each one is written down in full — how it works, what changes, the trade-offs and the build order — so nothing gets lost before we build it.",
  updated: "November 4, 2026",
  features: [
    {
      id: "desktop-remote",
      status: "planned",
      badge: "Planned · after v1",
      title: "Lumen Desktop & Remote Access",
      tagline: "Your laptop does the AI. Any device can use it.",
      summary:
        "The same pattern as ChatGPT’s desktop app or Ollama’s remote access: a small app on the user’s laptop runs the models, and the website becomes a remote control for it — from a phone, a school computer, anywhere.",
      facts: [
        { label: "Status", value: "Planned" },
        { label: "Complexity", value: "High" },
        { label: "New pieces", value: "Desktop app + device relay" },
        { label: "Start with", value: "Chat only" },
      ],
      architecture: {
        nodes: [
          {
            id: "website",
            title: "Website",
            subtitle: "Any device — laptop, phone",
            icon: "globe",
            items: ["This Next.js UI", "Sign in, chats & history", "Shows “online / offline”", "Streams answers live"],
          },
          {
            id: "backend",
            title: "Spring Boot backend",
            subtitle: "Cloud · cheap VPS, no AI work",
            icon: "server",
            items: ["Auth & sessions", "Chats, history, settings (Postgres)", "Devices table + device relay", "Stores uploaded images"],
          },
          {
            id: "desktop",
            title: "Desktop app",
            subtitle: "User’s laptop · Tauri",
            icon: "laptop",
            items: [
              "Ollama + models",
              "AI service (your Python code)",
              "Local docs & embeddings",
              "Image generation",
              "Optional: same UI in a window",
            ],
          },
        ],
        links: [
          {
            from: "website",
            to: "backend",
            label: "HTTPS + WebSocket",
            detail: "Requests in, streamed replies out",
          },
          {
            from: "desktop",
            to: "backend",
            label: "Outbound WebSocket",
            detail: "The laptop dials out — no port forwarding",
          },
        ],
        notes: ["No open ports on the laptop", "Files never leave the laptop", "Backend only relays & syncs"],
      },
      howItWorks: [
        {
          title: "Install the desktop app",
          detail:
            "On first run it signs in, installs Ollama if needed, downloads the models with a progress bar, and starts the AI service in the background.",
        },
        {
          title: "The app connects out",
          detail:
            "It opens a WebSocket to the backend — no port forwarding or router setup — and registers as “Sokha’s MacBook – online”.",
        },
        {
          title: "The website routes AI work",
          detail:
            "When the user sends a message on the website, the backend forwards it over that connection. The laptop generates the reply and streams it back the same way.",
        },
        {
          title: "Sync through the backend",
          detail:
            "Chats, history and settings live in Postgres, so the website and the desktop app always show the same conversations. The app can also show the same Next.js UI in its own window.",
        },
      ],
      journey: [
        { actor: "website", title: "Send", detail: "You type a message on your phone." },
        { actor: "backend", title: "Authenticate & save", detail: "Backend checks the session and stores the message in Postgres." },
        { actor: "backend", title: "Find your computer", detail: "The device relay looks up which of your devices is online." },
        { actor: "desktop", title: "Deliver the job", detail: "The job goes down the laptop’s already-open WebSocket." },
        { actor: "desktop", title: "Generate", detail: "Ollama runs the model; tokens stream back over the same socket." },
        { actor: "website", title: "Stream & sync", detail: "Backend relays tokens to the website live and saves the final answer." },
      ],
      firstRun: [
        "Sign in",
        "Install Ollama if missing",
        "Download models (progress bar)",
        "Start AI service in background",
        "Register device · online",
      ],
      changes: [
        {
          area: "Backend",
          now: "Runs next to the AI service",
          planned: "Moves to a cloud server — a cheap VPS is fine because it does no AI work",
        },
        { area: "AI service", now: "Part of the server stack", planned: "Ships inside the desktop installer" },
        {
          area: "Call direction",
          now: "Spring Boot calls the AI service",
          planned: "The AI service connects to Spring Boot and waits for jobs",
        },
        {
          area: "New pieces",
          now: "—",
          planned: "A devices table plus a “device relay” that knows which user’s computer is online",
        },
        {
          area: "Documents & embeddings",
          now: "Stored on the server",
          planned: "Stay on the laptop in SQLite + sqlite-vec — only answers and citations reach the backend",
        },
        {
          area: "Generated images",
          now: "Made and stored on the server",
          planned: "Made locally, then uploaded to the backend so the website can show them",
        },
      ],
      tech: [
        {
          name: "Tauri",
          role: "Desktop app",
          detail: "Much smaller than Electron, and can wrap the existing Next.js UI.",
          icon: "app",
        },
        {
          name: "PyInstaller sidecar",
          role: "AI service",
          detail: "Bundle the Python AI service as a Tauri sidecar binary.",
          icon: "package",
        },
        {
          name: "Ollama",
          role: "Model runtime",
          detail: "Either require users to install it, or run its installer from our setup.",
          icon: "cpu",
        },
        {
          name: "SQLite + sqlite-vec",
          role: "Local vector store",
          detail: "Documents and embeddings stay on the laptop — a privacy feature.",
          icon: "database",
        },
        {
          name: "Spring Boot + WebSocket",
          role: "Relay & sync",
          detail: "Keeps one socket per online device and routes each user’s jobs to it.",
          icon: "server",
        },
        { name: "Postgres", role: "Source of truth", detail: "Chats, history, settings and devices.", icon: "database" },
      ],
      pairing: [
        { title: "Log in inside the app", detail: "Same account as the website." },
        { title: "Backend issues a device token", detail: "Tied to this user and this computer." },
        { title: "App reconnects with the token", detail: "No password stored on the device." },
        { title: "Heartbeat", detail: "Regular pings let the website show online / offline." },
      ],
      tradeOffs: [
        {
          title: "The laptop must be on",
          detail: "Awake and running the app — otherwise the website shows “Your computer is offline”.",
          icon: "power",
        },
        {
          title: "Security matters",
          detail: "Only accept jobs from our backend for the signed-in user, and never expose an open port.",
          icon: "shield",
        },
        {
          title: "Packaging is the hard part",
          detail: "macOS code signing, Windows installers and multi-GB model downloads all take real time.",
          icon: "package",
        },
        {
          title: "A whole new piece",
          detail: "It adds a desktop app to an already big project — plan the time for it.",
          icon: "layers",
        },
      ],
      phases: [
        { title: "Current version, end to end", detail: "Get today’s web app fully working with the real backend.", status: "in-progress" },
        { title: "Desktop app, locally", detail: "Package the AI service into a Tauri app that works on its own.", status: "planned" },
        { title: "Relay — chat only", detail: "Add the device relay so the website can use that computer for chat.", status: "planned" },
        { title: "Documents & images", detail: "Route document Q&A and image generation through the relay.", status: "planned" },
      ],
      extras: {
        devicesTable: [
          { name: "id", type: "uuid", note: "Primary key" },
          { name: "user_id", type: "uuid → users", note: "Owner; every job is scoped to it" },
          { name: "name", type: "text", note: "“Sokha’s MacBook”" },
          { name: "platform", type: "text", note: "macos · windows · linux" },
          { name: "token_hash", type: "text", note: "Hash of the device token — never the token itself" },
          { name: "app_version", type: "text", note: "For update prompts & compatibility" },
          { name: "models", type: "jsonb", note: "Installed models and their state" },
          { name: "last_seen_at", type: "timestamptz", note: "Updated by heartbeat → online / offline" },
          { name: "revoked_at", type: "timestamptz?", note: "Sign a device out remotely" },
        ],
        protocol: `// Backend → desktop (over the device's WebSocket)
{ "type": "job.chat", "jobId": "j_81f", "chatId": "c_42",
  "model": "gemma-4-e2b", "messages": [ … ] }

// Desktop → backend, many times while generating
{ "type": "job.delta", "jobId": "j_81f", "text": "Plants catch " }

// Desktop → backend, once at the end
{ "type": "job.done", "jobId": "j_81f", "citations": [ … ] }

// Desktop → backend, every ~15 s
{ "type": "heartbeat", "models": ["gemma-4-e2b"], "busy": false }`,
        security: [
          "Device tokens stored only as a hash, revocable from Settings → Devices",
          "TLS-only (wss://); the app pins the backend host and never listens on a port",
          "Every job carries user + device id; the app rejects anything else",
          "Rate-limit jobs per user; cancel jobs when the website disconnects",
          "Rotate device tokens periodically and on sign-out",
        ],
        openQuestions: [
          "A user has two computers online — which one takes the job?",
          "The laptop sleeps mid-answer — resume, retry or fail cleanly?",
          "Resumable model downloads and disk-space checks before downloading",
          "Auto-updates for the desktop app (Tauri updater) and version compatibility",
          "Should the desktop app still work offline when the backend is unreachable?",
        ],
      },
    },
  ],
};
