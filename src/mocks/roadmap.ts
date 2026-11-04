import type { Localized } from "@/i18n/config";
import type { RoadmapContent } from "@/types/roadmap";

/* English and Khmer copies of the same roadmap. Technical names (Tauri,
   Ollama, Postgres…), the devices table columns and the protocol JSON stay
   identical in both; only prose and code comments are translated. */

const en: RoadmapContent = {
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

const km: RoadmapContent = {
  title: "នឹងមកដល់ឆាប់ៗ",
  intro:
    "គំនិតធំៗដែលបានគ្រោងទុកសម្រាប់ Lumen។ គំនិតនីមួយៗត្រូវបានសរសេរយ៉ាងលម្អិត — របៀបដំណើរការ អ្វីដែលនឹងផ្លាស់ប្តូរ គុណ និងវិបត្តិ ព្រមទាំងលំដាប់នៃការបង្កើត — ដើម្បីកុំឲ្យបាត់អ្វីមួយ មុនពេលយើងចាប់ផ្តើមបង្កើត។",
  updated: "ថ្ងៃទី៤ ខែវិច្ឆិកា ឆ្នាំ២០២៦",
  features: [
    {
      id: "desktop-remote",
      status: "planned",
      badge: "ក្នុងគម្រោង · បន្ទាប់ពី v1",
      title: "Lumen Desktop និងការប្រើពីចម្ងាយ",
      tagline: "កុំព្យូទ័ររបស់អ្នកដំណើរការ AI។ ឧបករណ៍ណាក៏អាចប្រើវាបាន។",
      summary:
        "ដូចគ្នានឹងកម្មវិធី desktop របស់ ChatGPT ឬការប្រើ Ollama ពីចម្ងាយ៖ កម្មវិធីតូចមួយនៅលើកុំព្យូទ័រយួរដៃរបស់អ្នកប្រើ ដំណើរការម៉ូដែល AI ហើយគេហទំព័រក្លាយជាឧបករណ៍បញ្ជាវាពីចម្ងាយ — ពីទូរស័ព្ទ ពីកុំព្យូទ័រនៅសាលា ឬពីគ្រប់ទីកន្លែង។",
      facts: [
        { label: "ស្ថានភាព", value: "ក្នុងគម្រោង" },
        { label: "ភាពស្មុគស្មាញ", value: "ខ្ពស់" },
        { label: "ផ្នែកថ្មី", value: "កម្មវិធី Desktop + device relay" },
        { label: "ចាប់ផ្តើមជាមួយ", value: "តែការជជែកសិន" },
      ],
      architecture: {
        nodes: [
          {
            id: "website",
            title: "គេហទំព័រ",
            subtitle: "ឧបករណ៍ណាក៏បាន — កុំព្យូទ័រ ទូរស័ព្ទ",
            icon: "globe",
            items: [
              "UI Next.js នេះ",
              "ចូលគណនី ការជជែក និងប្រវត្តិ",
              "បង្ហាញ “អនឡាញ / អហ្វឡាញ”",
              "បង្ហាញចម្លើយភ្លាមៗ ពេលកំពុងសរសេរ",
            ],
          },
          {
            id: "backend",
            title: "Backend Spring Boot",
            subtitle: "Cloud · VPS តម្លៃថោក មិនដំណើរការ AI",
            icon: "server",
            items: [
              "ការផ្ទៀងផ្ទាត់គណនី និង session",
              "ការជជែក ប្រវត្តិ ការកំណត់ (Postgres)",
              "តារាង devices + device relay",
              "រក្សាទុករូបភាពដែលបានផ្ទុកឡើង",
            ],
          },
          {
            id: "desktop",
            title: "កម្មវិធី Desktop",
            subtitle: "កុំព្យូទ័រយួរដៃរបស់អ្នកប្រើ · Tauri",
            icon: "laptop",
            items: [
              "Ollama + ម៉ូដែល",
              "សេវា AI (កូដ Python របស់អ្នក)",
              "ឯកសារ និង embeddings នៅក្នុងម៉ាស៊ីន",
              "ការបង្កើតរូបភាព",
              "ជម្រើស៖ UI ដដែលក្នុងផ្ទាំងវីនដូ",
            ],
          },
        ],
        links: [
          {
            from: "website",
            to: "backend",
            label: "HTTPS + WebSocket",
            detail: "សំណើចូលទៅ ចម្លើយហូរត្រឡប់មក",
          },
          {
            from: "desktop",
            to: "backend",
            label: "WebSocket ចេញក្រៅ",
            detail: "កុំព្យូទ័រភ្ជាប់ចេញទៅ — មិនបាច់ port forwarding",
          },
        ],
        notes: ["មិនបើក port លើកុំព្យូទ័រទេ", "ឯកសារមិនចាកចេញពីកុំព្យូទ័រឡើយ", "Backend គ្រាន់តែបញ្ជូនបន្ត និងធ្វើសមកាលកម្ម"],
      },
      howItWorks: [
        {
          title: "ដំឡើងកម្មវិធី Desktop",
          detail:
            "ពេលបើកលើកដំបូង វានឹងចូលគណនី ដំឡើង Ollama បើមិនទាន់មាន ទាញយកម៉ូដែលដោយមានរបារបង្ហាញវឌ្ឍនភាព ហើយចាប់ផ្តើមសេវា AI នៅផ្ទៃខាងក្រោយ។",
        },
        {
          title: "កម្មវិធីភ្ជាប់ចេញទៅក្រៅ",
          detail:
            "វាបើក WebSocket ទៅកាន់ backend — មិនចាំបាច់ port forwarding ឬកំណត់ router ទេ — ហើយចុះឈ្មោះខ្លួនជា “MacBook របស់សុខា – អនឡាញ”។",
        },
        {
          title: "គេហទំព័របញ្ជូនការងារ AI",
          detail:
            "ពេលអ្នកប្រើផ្ញើសារនៅលើគេហទំព័រ backend នឹងបញ្ជូនសារនោះតាមការតភ្ជាប់នេះ។ កុំព្យូទ័របង្កើតចម្លើយ ហើយផ្ញើវាត្រឡប់មកវិញតាមផ្លូវដដែល។",
        },
        {
          title: "ធ្វើសមកាលកម្មតាម backend",
          detail:
            "ការជជែក ប្រវត្តិ និងការកំណត់ ត្រូវរក្សាទុកក្នុង Postgres ដូច្នេះគេហទំព័រ និងកម្មវិធី Desktop តែងតែបង្ហាញការសន្ទនាដូចគ្នា។ កម្មវិធីក៏អាចបង្ហាញ UI Next.js ដដែលក្នុងផ្ទាំងវីនដូរបស់វាផងដែរ។",
        },
      ],
      journey: [
        { actor: "website", title: "ផ្ញើ", detail: "អ្នកវាយសារមួយនៅលើទូរស័ព្ទរបស់អ្នក។" },
        { actor: "backend", title: "ផ្ទៀងផ្ទាត់ និងរក្សាទុក", detail: "Backend ពិនិត្យ session ហើយរក្សាទុកសារក្នុង Postgres។" },
        { actor: "backend", title: "ស្វែងរកកុំព្យូទ័ររបស់អ្នក", detail: "Device relay ពិនិត្យមើលថាឧបករណ៍មួយណារបស់អ្នកកំពុងអនឡាញ។" },
        { actor: "desktop", title: "បញ្ជូនការងារ", detail: "ការងារត្រូវផ្ញើតាម WebSocket ដែលកុំព្យូទ័របានបើករួចជាស្រេច។" },
        { actor: "desktop", title: "បង្កើតចម្លើយ", detail: "Ollama ដំណើរការម៉ូដែល ហើយ token ហូរត្រឡប់មកវិញតាម socket ដដែល។" },
        { actor: "website", title: "បង្ហាញ និងធ្វើសមកាលកម្ម", detail: "Backend បញ្ជូន token ទៅគេហទំព័រភ្លាមៗ ហើយរក្សាទុកចម្លើយចុងក្រោយ។" },
      ],
      firstRun: [
        "ចូលគណនី",
        "ដំឡើង Ollama បើមិនទាន់មាន",
        "ទាញយកម៉ូដែល (របារវឌ្ឍនភាព)",
        "ចាប់ផ្តើមសេវា AI នៅផ្ទៃខាងក្រោយ",
        "ចុះឈ្មោះឧបករណ៍ · អនឡាញ",
      ],
      changes: [
        {
          area: "Backend",
          now: "ដំណើរការនៅជាប់សេវា AI",
          planned: "ផ្លាស់ទៅម៉ាស៊ីនមេ cloud — VPS តម្លៃថោកក៏គ្រប់គ្រាន់ ព្រោះវាមិនដំណើរការ AI",
        },
        { area: "សេវា AI", now: "ជាផ្នែកមួយនៃម៉ាស៊ីនមេ", planned: "ភ្ជាប់មកជាមួយកម្មវិធីដំឡើង Desktop" },
        {
          area: "ទិសដៅនៃការហៅ",
          now: "Spring Boot ហៅទៅសេវា AI",
          planned: "សេវា AI ភ្ជាប់ទៅ Spring Boot ហើយរង់ចាំការងារ",
        },
        {
          area: "ផ្នែកថ្មី",
          now: "—",
          planned: "តារាង devices និង “device relay” ដែលដឹងថាកុំព្យូទ័ររបស់អ្នកប្រើណាខ្លះកំពុងអនឡាញ",
        },
        {
          area: "ឯកសារ និង embeddings",
          now: "រក្សាទុកលើម៉ាស៊ីនមេ",
          planned: "នៅលើកុំព្យូទ័រក្នុង SQLite + sqlite-vec — មានតែចម្លើយ និងប្រភពយោងប៉ុណ្ណោះដែលទៅដល់ backend",
        },
        {
          area: "រូបភាពដែលបានបង្កើត",
          now: "បង្កើត និងរក្សាទុកលើម៉ាស៊ីនមេ",
          planned: "បង្កើតនៅក្នុងកុំព្យូទ័រ រួចផ្ទុកឡើងទៅ backend ដើម្បីឲ្យគេហទំព័រអាចបង្ហាញបាន",
        },
      ],
      tech: [
        {
          name: "Tauri",
          role: "កម្មវិធី Desktop",
          detail: "តូចជាង Electron ច្រើន ហើយអាចរុំ UI Next.js ដែលមានស្រាប់បាន។",
          icon: "app",
        },
        {
          name: "PyInstaller sidecar",
          role: "សេវា AI",
          detail: "វេចខ្ចប់សេវា AI ដែលសរសេរដោយ Python ជា binary sidecar របស់ Tauri។",
          icon: "package",
        },
        {
          name: "Ollama",
          role: "កម្មវិធីដំណើរការម៉ូដែល",
          detail: "ឲ្យអ្នកប្រើដំឡើងវាដោយខ្លួនឯង ឬដំណើរការកម្មវិធីដំឡើងរបស់វាពីក្នុងការរៀបចំរបស់យើង។",
          icon: "cpu",
        },
        {
          name: "SQLite + sqlite-vec",
          role: "ឃ្លាំងវ៉ិចទ័រក្នុងម៉ាស៊ីន",
          detail: "ឯកសារ និង embeddings នៅតែលើកុំព្យូទ័រ — ជាចំណុចល្អផ្នែកឯកជនភាព។",
          icon: "database",
        },
        {
          name: "Spring Boot + WebSocket",
          role: "បញ្ជូនបន្ត និងសមកាលកម្ម",
          detail: "រក្សា socket មួយសម្រាប់ឧបករណ៍អនឡាញនីមួយៗ ហើយបញ្ជូនការងាររបស់អ្នកប្រើម្នាក់ៗទៅកាន់វា។",
          icon: "server",
        },
        { name: "Postgres", role: "ប្រភពទិន្នន័យចម្បង", detail: "ការជជែក ប្រវត្តិ ការកំណត់ និងឧបករណ៍។", icon: "database" },
      ],
      pairing: [
        { title: "ចូលគណនីក្នុងកម្មវិធី", detail: "គណនីដូចគ្នានឹងគេហទំព័រ។" },
        { title: "Backend ចេញ device token", detail: "ភ្ជាប់នឹងអ្នកប្រើនេះ និងកុំព្យូទ័រនេះ។" },
        { title: "កម្មវិធីភ្ជាប់ឡើងវិញដោយប្រើ token", detail: "មិនរក្សាទុកពាក្យសម្ងាត់លើឧបករណ៍ទេ។" },
        { title: "Heartbeat", detail: "ការ ping ជាប្រចាំ ធ្វើឲ្យគេហទំព័របង្ហាញបានថា អនឡាញ ឬអហ្វឡាញ។" },
      ],
      tradeOffs: [
        {
          title: "កុំព្យូទ័រត្រូវតែបើក",
          detail: "ត្រូវភ្ញាក់ (មិន sleep) ហើយបើកកម្មវិធី — បើមិនដូច្នោះទេ គេហទំព័រនឹងបង្ហាញ “កុំព្យូទ័ររបស់អ្នកកំពុងអហ្វឡាញ”។",
          icon: "power",
        },
        {
          title: "សុវត្ថិភាពសំខាន់ណាស់",
          detail: "ទទួលការងារតែពី backend របស់យើង សម្រាប់អ្នកប្រើដែលបានចូលគណនីប៉ុណ្ណោះ ហើយមិនត្រូវបើក port ចំហឡើយ។",
          icon: "shield",
        },
        {
          title: "ការវេចខ្ចប់ជាផ្នែកពិបាកបំផុត",
          detail: "ការចុះហត្ថលេខាកូដលើ macOS កម្មវិធីដំឡើងលើ Windows និងការទាញយកម៉ូដែលទំហំច្រើន GB សុទ្ធតែចំណាយពេលច្រើន។",
          icon: "package",
        },
        {
          title: "ផ្នែកថ្មីទាំងស្រុង",
          detail: "វាបន្ថែមកម្មវិធី Desktop មួយទៀតទៅក្នុងគម្រោងដែលធំស្រាប់ — ត្រូវគ្រោងពេលវេលាសម្រាប់វា។",
          icon: "layers",
        },
      ],
      phases: [
        { title: "កំណែបច្ចុប្បន្ន ឲ្យដំណើរការពេញលេញ", detail: "ធ្វើឲ្យកម្មវិធីវេបបច្ចុប្បន្នដំណើរការពេញលេញជាមួយ backend ពិតប្រាកដ។", status: "in-progress" },
        { title: "កម្មវិធី Desktop ក្នុងម៉ាស៊ីន", detail: "វេចខ្ចប់សេវា AI ទៅក្នុងកម្មវិធី Tauri ដែលអាចដំណើរការដោយខ្លួនឯង។", status: "planned" },
        { title: "Relay — តែការជជែកសិន", detail: "បន្ថែម device relay ដើម្បីឲ្យគេហទំព័រអាចប្រើកុំព្យូទ័រនោះសម្រាប់ការជជែក។", status: "planned" },
        { title: "ឯកសារ និងរូបភាព", detail: "បញ្ជូនការសួរឆ្លើយលើឯកសារ និងការបង្កើតរូបភាពតាមរយៈ relay។", status: "planned" },
      ],
      extras: {
        devicesTable: [
          { name: "id", type: "uuid", note: "កូនសោចម្បង (primary key)" },
          { name: "user_id", type: "uuid → users", note: "ម្ចាស់ — ការងារនីមួយៗត្រូវកំណត់ត្រឹមអ្នកប្រើនេះ" },
          { name: "name", type: "text", note: "“MacBook របស់សុខា”" },
          { name: "platform", type: "text", note: "macos · windows · linux" },
          { name: "token_hash", type: "text", note: "Hash របស់ device token — មិនមែន token ផ្ទាល់ទេ" },
          { name: "app_version", type: "text", note: "សម្រាប់ជូនដំណឹងឲ្យអាប់ដេត និងភាពត្រូវគ្នា" },
          { name: "models", type: "jsonb", note: "ម៉ូដែលដែលបានដំឡើង និងស្ថានភាពរបស់វា" },
          { name: "last_seen_at", type: "timestamptz", note: "ធ្វើបច្ចុប្បន្នភាពដោយ heartbeat → អនឡាញ / អហ្វឡាញ" },
          { name: "revoked_at", type: "timestamptz?", note: "ចាកចេញពីឧបករណ៍ពីចម្ងាយ" },
        ],
        protocol: `// Backend → desktop (តាម WebSocket របស់ឧបករណ៍)
{ "type": "job.chat", "jobId": "j_81f", "chatId": "c_42",
  "model": "gemma-4-e2b", "messages": [ … ] }

// Desktop → backend, ច្រើនដងពេលកំពុងបង្កើតចម្លើយ
{ "type": "job.delta", "jobId": "j_81f", "text": "Plants catch " }

// Desktop → backend, ម្តងនៅចុងបញ្ចប់
{ "type": "job.done", "jobId": "j_81f", "citations": [ … ] }

// Desktop → backend, រៀងរាល់ ~15 វិនាទី
{ "type": "heartbeat", "models": ["gemma-4-e2b"], "busy": false }`,
        security: [
          "Device token រក្សាទុកតែជា hash ហើយអាចដកសិទ្ធិបានពី ការកំណត់ → ឧបករណ៍",
          "ប្រើតែ TLS (wss://) ប៉ុណ្ណោះ; កម្មវិធី pin host របស់ backend ហើយមិនបើកចាំស្តាប់ port ណាមួយឡើយ",
          "ការងារនីមួយៗមាន id អ្នកប្រើ + ឧបករណ៍; កម្មវិធីបដិសេធអ្វីផ្សេងពីនេះ",
          "កំណត់ចំនួនការងារក្នុងអ្នកប្រើម្នាក់ (rate-limit); បោះបង់ការងារពេលគេហទំព័រផ្តាច់",
          "ប្តូរ device token ជាទៀងទាត់ និងពេលចាកចេញពីគណនី",
        ],
        openQuestions: [
          "អ្នកប្រើមានកុំព្យូទ័រពីរកំពុងអនឡាញ — តើមួយណាទទួលការងារ?",
          "កុំព្យូទ័រ sleep ពេលកំពុងឆ្លើយ — បន្ត ព្យាយាមម្តងទៀត ឬបញ្ចប់ដោយមានសារច្បាស់លាស់?",
          "ការទាញយកម៉ូដែលដែលអាចបន្តពីកន្លែងដាច់ និងការពិនិត្យទំហំថាសមុនពេលទាញយក",
          "ការអាប់ដេតស្វ័យប្រវត្តិសម្រាប់កម្មវិធី Desktop (Tauri updater) និងភាពត្រូវគ្នានៃកំណែ",
          "តើកម្មវិធី Desktop គួរនៅតែដំណើរការក្រៅបណ្តាញ ពេលមិនអាចភ្ជាប់ទៅ backend បានដែរឬទេ?",
        ],
      },
    },
  ],
};

export const mockRoadmap: Localized<RoadmapContent> = { en, km };
