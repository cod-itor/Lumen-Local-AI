import type { AiSettingsContent } from "@/types/settings";

/**
 * Example data for Settings → AI & models. The supported model list isn't
 * final — add, remove or rename models here; the page renders whatever is
 * listed. Replace with what the local runtime reports once it's connected.
 */
export const mockAiSettings: AiSettingsContent = {
  runtime: { name: "Ollama", host: "localhost:11434", version: "0.13", connected: true },

  explainer: {
    title: "Lumen runs on the AI you install",
    body:
      "Lumen doesn’t host any AI. Every answer, document search and image is made by models running on your own computer. What Lumen knows and how well it answers depends on the models you’ve installed — Lumen adds the rules, prompts and guardrails that turn them into a study partner.",
    points: [
      { title: "Your computer", detail: "Runs the models through Ollama. Nothing is sent to an AI company." },
      { title: "Lumen", detail: "Gives each model its job, its rules and its tools, and checks what goes in and out." },
      { title: "You", detail: "Choose which model does which job, and see exactly what each one is allowed to do." },
    ],
  },

  roles: [
    {
      id: "chat",
      title: "Learning & chat",
      job: "Answers questions, explains topics step by step, runs learning paths and quizzes, and decides when to use a tool.",
      usedIn: ["Chat", "Learning paths", "Documents (writes the answer)"],
      icon: "chat",
      slots: [
        {
          label: "Chat model",
          modelId: "gemma4:e2b",
          accepts: "chat",
          why: "Writes every reply and calls tools.",
        },
      ],
      requirements: ["Must support tool calling", "Khmer & English recommended", "8K+ context window"],
      tools: [
        { name: "Web search", when: "Only when you turn Search on" },
        { name: "Quiz builder", when: "In learning paths and when you ask for a quiz" },
        { name: "Learning path steps", when: "When following a path" },
        { name: "Document search", when: "In Documents, over the files you selected" },
      ],
      install: ["ollama pull gemma4:e2b"],
      alternatives: [
        { name: "Gemma 4 E4B", note: "Better answers · needs 16 GB RAM" },
        { name: "Qwen 3 4B", note: "Fast · strong tool calling" },
        { name: "Any Ollama model with tool calling", note: "Quality varies — smaller models make more mistakes" },
      ],
    },
    {
      id: "rag",
      title: "Documents (RAG)",
      job: "Reads your files, finds the passages that answer your question, and makes sure answers cite the exact page.",
      usedIn: ["Documents", "Chat with sources"],
      icon: "rag",
      slots: [
        {
          label: "Embedding model",
          modelId: "embeddinggemma",
          accepts: "embedding",
          why: "Turns each page into numbers so it can be searched by meaning.",
        },
        {
          label: "Answer model",
          modelId: "gemma4:e2b",
          accepts: "chat",
          why: "Same as Learning & chat — writes the answer from the found passages.",
        },
      ],
      requirements: ["An embedding model", "Files are processed once, then stored on this computer"],
      pipeline: ["Split your file into passages", "Embed each passage", "Store on this computer", "Find the best passages from selected files", "Answer with page citations"],
      install: ["ollama pull embeddinggemma"],
      alternatives: [
        { name: "nomic-embed-text", note: "Small and fast · English-focused" },
        { name: "bge-m3", note: "Multilingual · larger" },
      ],
    },
    {
      id: "image",
      title: "Image generation",
      job: "Creates and edits images from your descriptions — posters, diagrams, illustrations for notes.",
      usedIn: ["Image"],
      icon: "image",
      slots: [
        {
          label: "Image model",
          modelId: "flux2-klein",
          accepts: "image",
          why: "Loaded only while generating, to save memory.",
        },
      ],
      requirements: ["GPU or Apple silicon recommended", "~8 GB free memory while generating"],
      install: ["Download from Lumen the first time you open Image"],
      alternatives: [
        { name: "Stable Diffusion 3.5 Medium", note: "Works on more GPUs · slower" },
        { name: "SDXL Turbo", note: "Very fast · lower detail" },
      ],
    },
  ],

  installed: [
    { id: "gemma4:e2b", name: "Gemma 4 E2B", role: "chat", size: "3.2 GB", state: "ready", capabilities: ["Tool calling", "Khmer & English", "128K context"] },
    { id: "qwen3:4b", name: "Qwen 3 4B", role: "chat", size: "2.6 GB", state: "ready", capabilities: ["Tool calling", "32K context"] },
    { id: "embeddinggemma", name: "EmbeddingGemma", role: "embedding", size: "0.6 GB", state: "ready", capabilities: ["Multilingual", "Embeddings"] },
    { id: "flux2-klein", name: "FLUX.2 klein", role: "image", size: "7.8 GB", state: "ready", capabilities: ["Text to image", "Image editing"] },
    { id: "gemma4:e4b", name: "Gemma 4 E4B", role: "chat", size: "5.9 GB", state: "downloading", progress: 42, capabilities: ["Tool calling", "Khmer & English"] },
  ],

  setup: [
    { title: "Install Ollama", detail: "The free app that runs AI models on your computer.", command: "https://ollama.com/download" },
    { title: "Download a chat model", detail: "Powers chat, learning paths and tool calling.", command: "ollama pull gemma4:e2b" },
    { title: "Download an embedding model", detail: "Lets Lumen search your documents by meaning.", command: "ollama pull embeddinggemma" },
    { title: "Add an image model (optional)", detail: "Lumen downloads it the first time you open Image." },
    { title: "Come back here", detail: "Each job turns green once its model is ready." },
  ],

  hardware: [
    { label: "Chat + documents", value: "8 GB RAM minimum · 16 GB recommended" },
    { label: "Images", value: "GPU or Apple silicon · ~8 GB free memory" },
    { label: "Disk space", value: "~5 GB for chat + docs · ~13 GB with images" },
  ],

  guardrails: [
    {
      id: "always",
      title: "Always on",
      appliesTo: "Every model, every feature",
      icon: "shield",
      rules: [
        { title: "Study-partner instructions", detail: "Every model gets Lumen’s instructions: explain clearly, step by step, at a student’s level." },
        { title: "Your language", detail: "Replies in the language you write in — Khmer or English." },
        { title: "Honest when unsure", detail: "Told to say “I’m not sure” instead of guessing, and to show sources when it has them." },
        { title: "Safety checks", detail: "Messages and replies are checked for harmful content before they’re shown." },
      ],
    },
    {
      id: "documents",
      title: "Documents",
      appliesTo: "Documents (RAG)",
      icon: "rag",
      rules: [
        { title: "Only your selected files", detail: "Answers come from the files you picked in “Answer from”, not the model’s general memory." },
        { title: "Cites the page", detail: "Every claim links to the passage it came from, so you can check it." },
        { title: "Says when it can’t find it", detail: "If the files don’t cover it, Lumen says so and lets you choose general knowledge." },
      ],
    },
    {
      id: "tools",
      title: "Tools",
      appliesTo: "Learning & chat",
      icon: "tool",
      rules: [
        { title: "Allow-list only", detail: "The model can only call the tools listed above — never your files, apps or system." },
        { title: "Web search needs your OK", detail: "Search runs only when the Search toggle is on, and only the search words go online." },
        { title: "Always visible", detail: "Every tool use is shown in the chat, e.g. “Searched 4 sites”." },
      ],
    },
    {
      id: "images",
      title: "Images",
      appliesTo: "Image generation",
      icon: "image",
      rules: [
        { title: "Prompt check first", detail: "Requests for explicit, violent or hateful images are declined before anything is generated." },
        { title: "No real people", detail: "Won’t make realistic images of real, identifiable people." },
        { title: "Made on this computer", detail: "Images are generated and saved locally." },
      ],
    },
    {
      id: "limits",
      title: "Limits",
      appliesTo: "Every model",
      icon: "sliders",
      rules: [
        { title: "Careful settings per job", detail: "Lower creativity (temperature) for documents and quizzes, a little more for open chat." },
        { title: "Context trimming", detail: "Long chats are trimmed to fit the model’s memory, keeping the most relevant parts." },
        { title: "Reply length cap", detail: "Keeps answers focused and stops runaway generations." },
      ],
    },
  ],
  guardrailNote:
    "These rules come from Lumen, not the model. Different models follow them better or worse — larger models are usually more reliable. Always check important answers.",

  privacy: [
    { feature: "Chat & learning", runsOn: "Your computer", leaves: "Nothing", level: "none" },
    { feature: "Web search", runsOn: "Your computer + the web", leaves: "Only the search words, and only when Search is on", level: "some" },
    { feature: "Documents", runsOn: "Your computer", leaves: "Nothing — files and embeddings stay here", level: "none" },
    { feature: "Images", runsOn: "Your computer", leaves: "Nothing", level: "none" },
    { feature: "Account", runsOn: "Lumen", leaves: "Your sign-in details. Chat sync across devices is planned.", level: "planned" },
  ],
};
