import type { Localized } from "@/i18n/config";
import type { AiSettingsContent } from "@/types/settings";

/**
 * Example data for Settings → AI & models. The supported model list isn't
 * final — add, remove or rename models here; the page renders whatever is
 * listed. Replace with what the local runtime reports once it's connected.
 * Every language has its own copy; model names, tags and commands are shared.
 */
const runtime: AiSettingsContent["runtime"] = { name: "Ollama", host: "localhost:11434", version: "0.13", connected: true };

const en: AiSettingsContent = {
  runtime,

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
          id: "chat",
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
          id: "embedding",
          label: "Embedding model",
          modelId: "embeddinggemma",
          accepts: "embedding",
          why: "Turns each page into numbers so it can be searched by meaning.",
        },
        {
          id: "answer",
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
          id: "image",
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
    { title: "Download a chat model", detail: "Powers chat, learning paths and quizzes.", command: "ollama pull llama3.2" },
    { title: "Download an embedding model", detail: "Lets Lumen search your documents by meaning.", command: "ollama pull embeddinggemma" },
    { title: "Add image generation (optional)", detail: "Run this in the Lumen folder (about 6 GB).", command: "./setup.sh --images" },
    { title: "Come back here", detail: "Settings → Models shows which models are ready." },
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

const km: AiSettingsContent = {
  runtime,

  explainer: {
    title: "Lumen ដំណើរការដោយ AI ដែលអ្នកដំឡើង",
    body:
      "Lumen មិនមាន AI ផ្ទាល់ខ្លួននៅលើម៉ាស៊ីនមេទេ។ រាល់ចម្លើយ ការស្វែងរកឯកសារ និងរូបភាព សុទ្ធតែបង្កើតដោយម៉ូដែលដែលដំណើរការលើកុំព្យូទ័ររបស់អ្នកផ្ទាល់។ អ្វីដែល Lumen ដឹង និងគុណភាពចម្លើយ អាស្រ័យលើម៉ូដែលដែលអ្នកបានដំឡើង — Lumen បន្ថែមច្បាប់ ការណែនាំ (prompts) និងការការពារ ដើម្បីធ្វើឱ្យវាក្លាយជាដៃគូរៀន។",
    points: [
      { title: "កុំព្យូទ័ររបស់អ្នក", detail: "ដំណើរការម៉ូដែលតាមរយៈ Ollama។ គ្មានអ្វីត្រូវបានផ្ញើទៅក្រុមហ៊ុន AI ណាមួយទេ។" },
      { title: "Lumen", detail: "ផ្ដល់ការងារ ច្បាប់ និងឧបករណ៍ដល់ម៉ូដែលនីមួយៗ ហើយពិនិត្យអ្វីដែលចូល និងចេញ។" },
      { title: "អ្នក", detail: "ជ្រើសរើសម៉ូដែលណាធ្វើការងារណា ហើយមើលឃើញច្បាស់ថាម៉ូដែលនីមួយៗអាចធ្វើអ្វីខ្លះ។" },
    ],
  },

  roles: [
    {
      id: "chat",
      title: "ការរៀន និងជជែក",
      job: "ឆ្លើយសំណួរ ពន្យល់ប្រធានបទមួយជំហានម្ដងៗ ដឹកនាំផ្លូវសិក្សា និងកម្រងសំណួរ ហើយសម្រេចថាពេលណាត្រូវប្រើឧបករណ៍។",
      usedIn: ["ជជែក", "ផ្លូវសិក្សា", "ឯកសារ (សរសេរចម្លើយ)"],
      icon: "chat",
      slots: [
        {
          id: "chat",
          label: "ម៉ូដែលជជែក",
          modelId: "gemma4:e2b",
          accepts: "chat",
          why: "សរសេររាល់ការឆ្លើយតប និងហៅឧបករណ៍។",
        },
      ],
      requirements: ["ត្រូវគាំទ្រការហៅឧបករណ៍ (tool calling)", "ណែនាំឱ្យគាំទ្រខ្មែរ និងអង់គ្លេស", "Context window ចាប់ពី 8K ឡើងទៅ"],
      tools: [
        { name: "ស្វែងរកលើអ៊ីនធឺណិត", when: "តែពេលអ្នកបើក Search ប៉ុណ្ណោះ" },
        { name: "បង្កើតកម្រងសំណួរ", when: "ក្នុងផ្លូវសិក្សា និងពេលអ្នកសុំកម្រងសំណួរ" },
        { name: "ជំហាននៃផ្លូវសិក្សា", when: "ពេលកំពុងរៀនតាមផ្លូវសិក្សា" },
        { name: "ស្វែងរកក្នុងឯកសារ", when: "ក្នុង ឯកសារ លើឯកសារដែលអ្នកបានជ្រើស" },
      ],
      install: ["ollama pull gemma4:e2b"],
      alternatives: [
        { name: "Gemma 4 E4B", note: "ចម្លើយល្អជាង · ត្រូវការ RAM 16 GB" },
        { name: "Qwen 3 4B", note: "លឿន · ហៅឧបករណ៍បានល្អ" },
        { name: "ម៉ូដែល Ollama ណាក៏បាន ដែលហៅឧបករណ៍បាន", note: "គុណភាពខុសៗគ្នា — ម៉ូដែលតូចៗច្រើនធ្វើខុស" },
      ],
    },
    {
      id: "rag",
      title: "ឯកសារ (RAG)",
      job: "អានឯកសាររបស់អ្នក រកផ្នែកដែលឆ្លើយសំណួររបស់អ្នក ហើយធានាថាចម្លើយយោងទៅទំព័រត្រឹមត្រូវ។",
      usedIn: ["ឯកសារ", "ជជែកជាមួយប្រភព"],
      icon: "rag",
      slots: [
        {
          id: "embedding",
          label: "ម៉ូដែល Embedding",
          modelId: "embeddinggemma",
          accepts: "embedding",
          why: "បំប្លែងទំព័រនីមួយៗទៅជាលេខ ដើម្បីអាចស្វែងរកតាមអត្ថន័យ។",
        },
        {
          id: "answer",
          label: "ម៉ូដែលឆ្លើយ",
          modelId: "gemma4:e2b",
          accepts: "chat",
          why: "ដូចគ្នានឹង ការរៀន និងជជែក — សរសេរចម្លើយពីផ្នែកដែលរកឃើញ។",
        },
      ],
      requirements: ["ម៉ូដែល Embedding មួយ", "ឯកសារត្រូវបានដំណើរការម្ដង រួចរក្សាទុកលើកុំព្យូទ័រនេះ"],
      pipeline: ["បំបែកឯកសាររបស់អ្នកជាផ្នែកៗ", "Embed ផ្នែកនីមួយៗ", "រក្សាទុកលើកុំព្យូទ័រនេះ", "រកផ្នែកល្អបំផុតពីឯកសារដែលបានជ្រើស", "ឆ្លើយដោយយោងលេខទំព័រ"],
      install: ["ollama pull embeddinggemma"],
      alternatives: [
        { name: "nomic-embed-text", note: "តូច និងលឿន · ផ្ដោតលើភាសាអង់គ្លេស" },
        { name: "bge-m3", note: "ច្រើនភាសា · ធំជាង" },
      ],
    },
    {
      id: "image",
      title: "បង្កើតរូបភាព",
      job: "បង្កើត និងកែរូបភាពពីការពិពណ៌នារបស់អ្នក — ផ្ទាំងរូបភាព ដ្យាក្រាម រូបគំនូរសម្រាប់កំណត់ចំណាំ។",
      usedIn: ["រូបភាព"],
      icon: "image",
      slots: [
        {
          id: "image",
          label: "ម៉ូដែលរូបភាព",
          modelId: "flux2-klein",
          accepts: "image",
          why: "ផ្ទុកតែពេលកំពុងបង្កើតរូបភាព ដើម្បីសន្សំអង្គចងចាំ។",
        },
      ],
      requirements: ["ណែនាំឱ្យមាន GPU ឬ Apple silicon", "អង្គចងចាំទំនេរប្រហែល 8 GB ពេលបង្កើតរូបភាព"],
      install: ["ទាញយកពី Lumen នៅពេលអ្នកបើក រូបភាព ជាលើកដំបូង"],
      alternatives: [
        { name: "Stable Diffusion 3.5 Medium", note: "ប្រើបានលើ GPU ច្រើនប្រភេទ · យឺតជាង" },
        { name: "SDXL Turbo", note: "លឿនណាស់ · លម្អិតតិចជាង" },
      ],
    },
  ],

  installed: [
    { id: "gemma4:e2b", name: "Gemma 4 E2B", role: "chat", size: "3.2 GB", state: "ready", capabilities: ["ហៅឧបករណ៍", "ខ្មែរ និងអង់គ្លេស", "Context 128K"] },
    { id: "qwen3:4b", name: "Qwen 3 4B", role: "chat", size: "2.6 GB", state: "ready", capabilities: ["ហៅឧបករណ៍", "Context 32K"] },
    { id: "embeddinggemma", name: "EmbeddingGemma", role: "embedding", size: "0.6 GB", state: "ready", capabilities: ["ច្រើនភាសា", "Embeddings"] },
    { id: "flux2-klein", name: "FLUX.2 klein", role: "image", size: "7.8 GB", state: "ready", capabilities: ["អត្ថបទទៅរូបភាព", "កែរូបភាព"] },
    { id: "gemma4:e4b", name: "Gemma 4 E4B", role: "chat", size: "5.9 GB", state: "downloading", progress: 42, capabilities: ["ហៅឧបករណ៍", "ខ្មែរ និងអង់គ្លេស"] },
  ],

  setup: [
    { title: "ដំឡើង Ollama", detail: "កម្មវិធីឥតគិតថ្លៃ ដែលដំណើរការម៉ូដែល AI លើកុំព្យូទ័ររបស់អ្នក។", command: "https://ollama.com/download" },
    { title: "ទាញយកម៉ូដែលជជែក", detail: "សម្រាប់ការជជែក ផ្លូវសិក្សា និងកម្រងសំណួរ។", command: "ollama pull llama3.2" },
    { title: "ទាញយកម៉ូដែល Embedding", detail: "អនុញ្ញាតឱ្យ Lumen ស្វែងរកឯកសាររបស់អ្នកតាមអត្ថន័យ។", command: "ollama pull embeddinggemma" },
    { title: "បន្ថែមការបង្កើតរូបភាព (ស្រេចចិត្ត)", detail: "ដំណើរការពាក្យបញ្ជានេះក្នុងថត Lumen (ប្រហែល 6 GB)។", command: "./setup.sh --images" },
    { title: "ត្រឡប់មកទីនេះវិញ", detail: "ការកំណត់ → ម៉ូដែល បង្ហាញម៉ូដែលណាដែលរួចរាល់។" },
  ],

  hardware: [
    { label: "ជជែក + ឯកសារ", value: "RAM យ៉ាងតិច 8 GB · ណែនាំ 16 GB" },
    { label: "រូបភាព", value: "GPU ឬ Apple silicon · អង្គចងចាំទំនេរប្រហែល 8 GB" },
    { label: "ទំហំថាស", value: "ប្រហែល 5 GB សម្រាប់ជជែក + ឯកសារ · ប្រហែល 13 GB រួមទាំងរូបភាព" },
  ],

  guardrails: [
    {
      id: "always",
      title: "បើកជានិច្ច",
      appliesTo: "គ្រប់ម៉ូដែល គ្រប់មុខងារ",
      icon: "shield",
      rules: [
        { title: "ការណែនាំជាដៃគូរៀន", detail: "ម៉ូដែលនីមួយៗទទួលការណែនាំពី Lumen៖ ពន្យល់ឱ្យច្បាស់ មួយជំហានម្ដងៗ តាមកម្រិតសិស្ស។" },
        { title: "ភាសារបស់អ្នក", detail: "ឆ្លើយជាភាសាដែលអ្នកសរសេរ — ខ្មែរ ឬអង់គ្លេស។" },
        { title: "ស្មោះត្រង់ពេលមិនច្បាស់", detail: "ត្រូវបានប្រាប់ឱ្យនិយាយថា «ខ្ញុំមិនច្បាស់ទេ» ជំនួសឱ្យការទាយ ហើយបង្ហាញប្រភពពេលមាន។" },
        { title: "ការត្រួតពិនិត្យសុវត្ថិភាព", detail: "សារ និងការឆ្លើយតបត្រូវបានពិនិត្យរកខ្លឹមសារគ្រោះថ្នាក់ មុនពេលបង្ហាញ។" },
      ],
    },
    {
      id: "documents",
      title: "ឯកសារ",
      appliesTo: "ឯកសារ (RAG)",
      icon: "rag",
      rules: [
        { title: "តែឯកសារដែលអ្នកបានជ្រើស", detail: "ចម្លើយមកពីឯកសារដែលអ្នករើសក្នុង «ឆ្លើយពី» មិនមែនពីការចងចាំទូទៅរបស់ម៉ូដែលទេ។" },
        { title: "យោងលេខទំព័រ", detail: "រាល់ការអះអាងភ្ជាប់ទៅផ្នែកដែលវាយកមក ដើម្បីឱ្យអ្នកអាចពិនិត្យបាន។" },
        { title: "ប្រាប់ពេលរកមិនឃើញ", detail: "បើឯកសារមិននិយាយពីរឿងនោះ Lumen នឹងប្រាប់អ្នក ហើយឱ្យអ្នកជ្រើសប្រើចំណេះដឹងទូទៅ។" },
      ],
    },
    {
      id: "tools",
      title: "ឧបករណ៍",
      appliesTo: "ការរៀន និងជជែក",
      icon: "tool",
      rules: [
        { title: "តែឧបករណ៍ក្នុងបញ្ជីអនុញ្ញាត", detail: "ម៉ូដែលអាចហៅបានតែឧបករណ៍ខាងលើប៉ុណ្ណោះ — មិនដែលចូលឯកសារ កម្មវិធី ឬប្រព័ន្ធរបស់អ្នកទេ។" },
        { title: "ការស្វែងរកលើអ៊ីនធឺណិតត្រូវការការយល់ព្រមពីអ្នក", detail: "Search ដំណើរការតែពេលបើកប៊ូតុង Search ហើយមានតែពាក្យស្វែងរកប៉ុណ្ណោះដែលទៅលើអ៊ីនធឺណិត។" },
        { title: "មើលឃើញជានិច្ច", detail: "រាល់ការប្រើឧបករណ៍ត្រូវបានបង្ហាញក្នុងការជជែក ឧ. «បានស្វែងរក ៤ គេហទំព័រ»។" },
      ],
    },
    {
      id: "images",
      title: "រូបភាព",
      appliesTo: "បង្កើតរូបភាព",
      icon: "image",
      rules: [
        { title: "ពិនិត្យសំណើជាមុន", detail: "សំណើរូបភាពអាសអាភាស ហិង្សា ឬញុះញង់ស្អប់ ត្រូវបានបដិសេធ មុនពេលបង្កើតអ្វីទាំងអស់។" },
        { title: "គ្មានមនុស្សពិត", detail: "មិនបង្កើតរូបភាពស្រដៀងមនុស្សពិត ដែលអាចស្គាល់មុខបានទេ។" },
        { title: "បង្កើតលើកុំព្យូទ័រនេះ", detail: "រូបភាពត្រូវបានបង្កើត និងរក្សាទុកក្នុងម៉ាស៊ីន។" },
      ],
    },
    {
      id: "limits",
      title: "ដែនកំណត់",
      appliesTo: "គ្រប់ម៉ូដែល",
      icon: "sliders",
      rules: [
        { title: "ការកំណត់ប្រុងប្រយ័ត្នតាមការងារ", detail: "ភាពច្នៃប្រឌិត (temperature) ទាបសម្រាប់ឯកសារ និងកម្រងសំណួរ ខ្ពស់បន្តិចសម្រាប់ការជជែកសេរី។" },
        { title: "កាត់បន្ថយបរិបទ", detail: "ការជជែកវែងៗត្រូវបានកាត់ឱ្យសមនឹងការចងចាំរបស់ម៉ូដែល ដោយរក្សាផ្នែកសំខាន់បំផុត។" },
        { title: "កំណត់ប្រវែងចម្លើយ", detail: "ធ្វើឱ្យចម្លើយផ្ដោតលើចំណុច និងបញ្ឈប់ការបង្កើតអត្ថបទដែលវែងគ្មានទីបញ្ចប់។" },
      ],
    },
  ],
  guardrailNote:
    "ច្បាប់ទាំងនេះមកពី Lumen មិនមែនពីម៉ូដែលទេ។ ម៉ូដែលផ្សេងៗគ្នាធ្វើតាមវាបានល្អ ឬមិនសូវល្អ — ម៉ូដែលធំៗជាធម្មតាគួរឱ្យទុកចិត្តជាង។ សូមពិនិត្យចម្លើយសំខាន់ៗជានិច្ច។",

  privacy: [
    { feature: "ជជែក និងការរៀន", runsOn: "កុំព្យូទ័ររបស់អ្នក", leaves: "គ្មានអ្វីទេ", level: "none" },
    { feature: "ស្វែងរកលើអ៊ីនធឺណិត", runsOn: "កុំព្យូទ័ររបស់អ្នក + អ៊ីនធឺណិត", leaves: "តែពាក្យស្វែងរក ហើយតែពេលបើក Search", level: "some" },
    { feature: "ឯកសារ", runsOn: "កុំព្យូទ័ររបស់អ្នក", leaves: "គ្មានអ្វីទេ — ឯកសារ និង embeddings នៅទីនេះ", level: "none" },
    { feature: "រូបភាព", runsOn: "កុំព្យូទ័ររបស់អ្នក", leaves: "គ្មានអ្វីទេ", level: "none" },
    { feature: "គណនី", runsOn: "Lumen", leaves: "ព័ត៌មានចូលគណនីរបស់អ្នក។ ការធ្វើសមកាលកម្មការជជែករវាងឧបករណ៍ កំពុងគ្រោងទុក។", level: "planned" },
  ],
};

export const mockAiSettings: Localized<AiSettingsContent> = { en, km };
