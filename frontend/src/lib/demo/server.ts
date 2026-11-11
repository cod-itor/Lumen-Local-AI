import type {
  AspectRatio,
  AuthResponse,
  ChatDto,
  EvalCategory,
  EvalResultDto,
  HarnessTurnRequest,
  ImageDto,
  InterviewItem,
  JobDto,
  LearningPathDto,
  LearningStepDto,
  MessageDto,
  MessageMeta,
  ModelProfile,
  OutputLanguage,
  PlanDto,
  ProjectDto,
  ProviderDto,
  SettingsDto,
  SourceDto,
  TurnDto,
  TurnResult,
  UserDto,
} from "@/types/api";
import * as C from "./content";
import { db, now, save, uid, type DemoDocument, type DemoEvalRun, type UserData } from "./db";
import { extractText } from "./extract";
import { DEMO_COOKIE } from "./mode";
import { DemoHttpError, errorResponse, fail, json, sleep, sse, type Emit } from "./http";

/**
 * The demo backend. `demoFetch` takes the same (path, init) as `fetch` and answers like the Spring backend
 * (API_CONTRACT.md): same paths, status codes, error bodies and SSE events, with sample content from ./content.ts.
 * Only loaded when NEXT_PUBLIC_LUMEN_DEMO=1 (see lib/api.ts).
 */

type Ctx = {
  m: RegExpMatchArray;
  q: URLSearchParams;
  body: Record<string, unknown>;
  form: FormData | null;
  signal?: AbortSignal;
  path: string;
};
type Handler = (c: Ctx, u: UserData, me: UserDto) => Promise<Response> | Response;
type PublicHandler = (c: Ctx) => Promise<Response> | Response;

const routes: { method: string; re: RegExp; auth: boolean; h: Handler | PublicHandler }[] = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push({ method, re: new RegExp(`^${pattern.replace(/\{id\}/g, "([^/]+)")}$`), auth: true, h });
const pub = (method: string, pattern: string, h: PublicHandler) =>
  routes.push({ method, re: new RegExp(`^${pattern}$`), auth: false, h });

// ---- helpers -----------------------------------------------------------------------------------------------------

const later = (ms: number) => new Date(Date.now() + ms).toISOString();

function setHint(on: boolean) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = on
    ? `${DEMO_COOKIE}=1; path=/; max-age=${14 * 86400}; samesite=lax${secure}`
    : `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}

const notFound = (resource: string) => fail(404, "NOT_FOUND", "Not found.", { resource });
const invalid = (fields: Record<string, string>) => fail(400, "VALIDATION_ERROR", "The request is not valid.", { fields });

function find<T extends { id: string }>(list: T[], id: string, resource: string): T {
  return list.find((x) => x.id === id) ?? notFound(resource);
}

function page<T>(items: T[], q: URLSearchParams) {
  const size = Math.min(100, Math.max(1, Number(q.get("size") ?? 20) || 20));
  const p = Math.max(0, Number(q.get("page") ?? 0) || 0);
  return {
    items: items.slice(p * size, p * size + size),
    page: p,
    size,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
}

const byUpdated = <T extends { updatedAt: string }>(a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt);
const byCreated = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function defaultSettings(): SettingsDto {
  let tz = "Asia/Phnom_Penh";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
  } catch {
    // keep default
  }
  return {
    theme: "SYSTEM", uiLanguage: "EN", outputLanguage: "EN", answerLength: "NORMAL", temperature: null,
    askBeforeSearch: false, guardProfile: "STANDARD", timezone: tz, showSpeedStats: true, defaultProviderId: null,
  };
}

const PROFILE: ModelProfile = {
  family: "demo", contextWindow: 8192, systemRole: true, jsonSchema: true, thinking: "NONE", disableThinking: "NONE",
  khmerNative: false, maxOutputTokens: 1024, topP: 0.9, repeatPenalty: 1.1, tokenFactor: 1,
};

function provider(name: string, kind: ProviderDto["kind"], model: string, isDefault: boolean, baseUrl: string | null = null): ProviderDto {
  return {
    id: uid(), name, kind,
    generation: "SERVER", // every demo model is "run" by the demo server (no download, no local Ollama)
    baseUrl, model, hasApiKey: false, isDefault, status: kind === "HOST" ? "OK" : "UNTESTED",
    lastTestedAt: kind === "HOST" ? now() : null, lastTestMessage: null, modelProfile: PROFILE,
    features: { chat: true, documents: true, webSearch: true, learning: true, images: kind === "HOST" },
    createdAt: now(),
  };
}

function settingsOf(u: UserData): SettingsDto {
  return { ...u.settings, defaultProviderId: u.providers.find((p) => p.isDefault)?.id ?? null };
}

const chatDto = (_u: UserData, c: ChatDto): ChatDto => ({ ...c });

function projectDto(u: UserData, p: ProjectDto): ProjectDto {
  return { ...p, chatCount: u.chats.filter((c) => c.projectId === p.id).length };
}

function meta(task: MessageDto["meta"]["task"], extra: Partial<MessageMeta> = {}): MessageMeta {
  return {
    task, pipeline: null, providerKind: null, model: null, outputLanguage: "EN", inputLanguage: null, sources: [],
    grounding: null, guard: null, tools: [], suggestions: [], stats: null, finishReason: null, feedback: null, ...extra,
  };
}

function message(chatId: string, parentId: string | null, role: MessageDto["role"], content: string, m: MessageMeta, status: MessageDto["status"] = "COMPLETE"): MessageDto {
  return { id: uid(), chatId, parentId, role, content, originalContent: null, translations: {}, status, meta: m, createdAt: now() };
}

function publicDoc(d: DemoDocument) {
  return {
    id: d.id, filename: d.filename, mime: d.mime, sizeBytes: d.sizeBytes, pages: d.pages, status: d.status, error: d.error,
    chunkCount: d.chunkCount, language: d.language, createdAt: d.createdAt,
  };
}

// ---- seed data for a new demo account ------------------------------------------------------------------------------

const GUIDE = `# Lumen demo guide

Lumen is a learning assistant whose AI runs on your own computer. This demo shows every screen with sample answers.

## Chat
Ask any study question. Turn on web search to get an answer with numbered sources from the web. Answers can be shown in English, Khmer or both.

## Documents
Upload a PDF, Word, TXT or Markdown file and ask questions about it. Every answer cites the passage it used, and clicking a citation opens that place in the file.

## Image
Describe a picture. Lumen asks a few questions, writes a better prompt for you to approve, then generates images. You can make variations or remove the background.

## Learning paths
Tell Lumen what you want to learn. It interviews you, proposes a step-by-step plan, writes short lessons and quizzes you after each one.

## Privacy
In the real app everything runs locally: your files, chats and models never leave your computer.`;

function seed(): UserData {
  const host = provider("Demo model", "HOST", "lumen-demo", true);
  const u: UserData = {
    settings: defaultSettings(), chats: [], messages: [], projects: [], providers: [host], documents: [], jobs: [],
    imageSessions: [], images: [], paths: [], quizzes: [], evalRuns: [], turns: [],
  };
  const chunks = C.chunkPages([GUIDE]).map((c) => ({ id: uid(), ...c }));
  u.documents.push({
    id: uid(), filename: "Lumen-demo-guide.md", mime: "text/markdown", sizeBytes: GUIDE.length, pages: null, status: "READY",
    error: null, chunkCount: chunks.length, language: "EN", createdAt: now(), pageTexts: [GUIDE], chunks, fingerprint: "seed-guide",
  });
  return u;
}

// ---- auth --------------------------------------------------------------------------------------------------------

function authResponse(user: UserDto, u: UserData): AuthResponse {
  return { user, settings: settingsOf(u), accessToken: "demo", accessTokenExpiresAt: later(30 * 60_000) };
}

pub("POST", "/api/auth/register", ({ body }) => {
  const name = str(body.name).trim();
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const fields: Record<string, string> = {};
  if (name.length < 1 || name.length > 60) fields.name = "1–60 characters";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fields.email = "Enter a valid email";
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) fields.password = "8–72 characters with a letter and a digit";
  if (Object.keys(fields).length) invalid(fields);
  if (db.accountByEmail(email)) fail(409, "EMAIL_TAKEN", "An account with this email already exists.");
  const user: UserDto = { id: uid(), name, email, role: "USER", createdAt: now() };
  const data = seed();
  db.addAccount({ user, password }, data);
  db.setSession(user.id);
  setHint(true);
  return json(authResponse(user, data), 201);
});

pub("POST", "/api/auth/login", ({ body }) => {
  const a = db.accountByEmail(str(body.email));
  if (!a || a.password !== str(body.password)) fail(401, "INVALID_CREDENTIALS", "Wrong email or password.");
  db.setSession(a!.user.id);
  setHint(true);
  return json(authResponse(a!.user, db.data(a!.user.id)));
});

pub("POST", "/api/auth/refresh", () => {
  const a = db.me();
  if (!a) {
    setHint(false);
    fail(401, "REFRESH_INVALID", "Your session ended. Please log in again.");
  }
  return json(authResponse(a!.user, db.data(a!.user.id)));
});

pub("POST", "/api/auth/logout", () => {
  db.setSession(null);
  setHint(false);
  return json(null, 204);
});

on("GET", "/api/auth/me", (_c, u, me) => json({ user: me, settings: settingsOf(u) }));

on("DELETE", "/api/users/me", ({ body }, _u, me) => {
  const a = db.me();
  if (!a || a.password !== str(body.password)) fail(401, "INVALID_CREDENTIALS", "Wrong password.");
  db.removeAccount(me.id);
  setHint(false);
  return json(null, 204);
});

// ---- settings ----------------------------------------------------------------------------------------------------

on("GET", "/api/settings", (_c, u) => json(settingsOf(u)));
on("PATCH", "/api/settings", ({ body }, u) => {
  const { defaultProviderId, ...rest } = body as Partial<SettingsDto>;
  if (defaultProviderId) {
    find(u.providers, defaultProviderId, "provider");
    u.providers.forEach((p) => (p.isDefault = p.id === defaultProviderId));
  }
  u.settings = { ...u.settings, ...rest };
  save();
  return json(settingsOf(u));
});

// ---- chats, projects, messages -------------------------------------------------------------------------------------

on("GET", "/api/chats", ({ q }, u) => {
  const tab = q.get("tab") ?? "CHAT";
  const term = (q.get("q") ?? "").trim().toLowerCase();
  const projectId = q.get("projectId");
  const items = u.chats
    .filter((c) => c.tab === tab && (!term || c.title.toLowerCase().includes(term)) && (!projectId || c.projectId === projectId))
    .sort(byUpdated)
    .map((c) => chatDto(u, c));
  return json(page(items, q));
});

on("POST", "/api/chats", ({ body }, u) => {
  const title = str(body.title).trim().slice(0, 80);
  const ids = Array.isArray(body.documentIds) ? (body.documentIds as string[]) : [];
  const c: ChatDto = {
    id: uid(), tab: body.tab === "DOCS" ? "DOCS" : "CHAT", title: title || "New chat", titleSource: title ? "USER" : "DEFAULT",
    documentIds: ids.filter((id) => u.documents.some((d) => d.id === id && d.status === "READY")),
    activeLeafId: null, lastMessagePreview: null, pinned: false, projectId: null, createdAt: now(), updatedAt: now(),
  };
  u.chats.push(c);
  save();
  return json(c, 201);
});

on("GET", "/api/chats/{id}", ({ m }, u) => json(chatDto(u, find(u.chats, m[1], "chat"))));

on("PATCH", "/api/chats/{id}", ({ m, body }, u) => {
  const c = find(u.chats, m[1], "chat");
  if (typeof body.title === "string" && body.title.trim()) {
    c.title = body.title.trim().slice(0, 120);
    c.titleSource = "USER";
  }
  if (Array.isArray(body.documentIds)) c.documentIds = (body.documentIds as string[]).filter((id) => u.documents.some((d) => d.id === id));
  if (typeof body.activeLeafId === "string") {
    find(u.messages.filter((x) => x.chatId === c.id), body.activeLeafId, "message");
    c.activeLeafId = body.activeLeafId;
  }
  if (typeof body.pinned === "boolean") c.pinned = body.pinned;
  if (typeof body.projectId === "string") c.projectId = find(u.projects, body.projectId, "project").id;
  if (body.removeFromProject === true) c.projectId = null;
  save();
  return json(chatDto(u, c));
});

on("DELETE", "/api/chats/{id}", ({ m }, u) => {
  find(u.chats, m[1], "chat");
  u.chats = u.chats.filter((c) => c.id !== m[1]);
  u.messages = u.messages.filter((x) => x.chatId !== m[1]);
  save();
  return json(null, 204);
});

on("GET", "/api/chats/{id}/messages", ({ m }, u) => {
  const c = find(u.chats, m[1], "chat");
  const messages = u.messages.filter((x) => x.chatId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return json({ chatId: c.id, activeLeafId: c.activeLeafId, messages });
});

on("GET", "/api/projects", (_c, u) => json([...u.projects].sort(byCreated).map((p) => projectDto(u, p))));
on("POST", "/api/projects", ({ body }, u) => {
  const name = str(body.name).trim();
  if (!name || name.length > 60) invalid({ name: "1–60 characters" });
  if (u.projects.length >= 100) fail(429, "QUOTA_EXCEEDED", "You have reached the limit of 100 projects.", { quota: "projects", limit: 100 });
  const p: ProjectDto = { id: uid(), name, chatCount: 0, createdAt: now(), updatedAt: now() };
  u.projects.push(p);
  save();
  return json(p, 201);
});
on("PATCH", "/api/projects/{id}", ({ m, body }, u) => {
  const p = find(u.projects, m[1], "project");
  const name = str(body.name).trim();
  if (!name || name.length > 60) invalid({ name: "1–60 characters" });
  p.name = name;
  p.updatedAt = now();
  save();
  return json(projectDto(u, p));
});
on("DELETE", "/api/projects/{id}", ({ m }, u) => {
  find(u.projects, m[1], "project");
  u.projects = u.projects.filter((p) => p.id !== m[1]);
  u.chats.forEach((c) => c.projectId === m[1] && (c.projectId = null));
  save();
  return json(null, 204);
});

on("POST", "/api/messages/{id}/translate", ({ m, body }, u) => {
  const msg = find(u.messages, m[1], "message");
  const target = body.target === "KM" ? "KM" : "EN";
  let text = msg.translations[target];
  if (!text) {
    const t = C.topicFor(msg.originalContent ?? msg.content);
    text = target === "KM" ? (t?.km ?? `**ការបកប្រែគំរូ (Demo)៖** នៅក្នុងកម្មវិធីពិត ចម្លើយនេះត្រូវបានបកប្រែជាភាសាខ្មែរដោយម៉ូដែលនៅលើកុំព្យូទ័ររបស់អ្នក។\n\n${msg.content}`) : (msg.originalContent ?? msg.content);
    msg.translations[target] = text;
    save();
  }
  return json({ messageId: msg.id, target, text });
});

on("POST", "/api/messages/{id}/feedback", ({ m, body }, u) => {
  const msg = find(u.messages, m[1], "message");
  msg.meta.feedback = { rating: body.rating === -1 ? -1 : 1, reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null };
  save();
  return json(null, 204);
});

// ---- providers -----------------------------------------------------------------------------------------------------

on("GET", "/api/providers", (_c, u) => json(u.providers));
on("GET", "/api/providers/catalog", () =>
  json({
    host: { available: true, models: ["lumen-demo"] },
    browser: {
      models: [
        { id: "Qwen3.5-2B-q4f16_1-MLC", fallbackId: "Qwen3.5-2B-q4f32_1-MLC", label: "Qwen 3.5 · 2B (recommended)", vramMb: 1900, fallbackVramMb: 2600, recommended: true },
        { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", fallbackId: "Llama-3.2-1B-Instruct-q4f32_1-MLC", label: "Llama 3.2 · 1B (small)", vramMb: 880, fallbackVramMb: 1130, recommended: false },
      ],
    },
    ollamaSuggestions: [
      { tag: "llama3.2", label: "Llama 3.2 · 3B", sizeGb: 2.0, note: "Fast, good English" },
      { tag: "gemma3:4b", label: "Gemma 3 · 4B", sizeGb: 3.3, note: "Better Khmer" },
    ],
  }),
);
on("POST", "/api/providers", ({ body }, u) => {
  const kind = body.kind === "BROWSER" || body.kind === "LOCAL_OLLAMA" || body.kind === "REMOTE_URL" ? body.kind : null;
  if (!kind) invalid({ kind: "Choose a model type" });
  if (kind === "REMOTE_URL") fail(503, "FEATURE_UNAVAILABLE", "Remote models are turned off in this app.");
  const model = str(body.model).trim();
  if (!model) invalid({ model: "Required" });
  const p = provider(str(body.name).trim() || model, kind!, model, false, kind === "LOCAL_OLLAMA" ? str(body.baseUrl) || "http://localhost:11434" : null);
  if (body.makeDefault === true) u.providers.forEach((x) => (x.isDefault = false));
  p.isDefault = body.makeDefault === true;
  u.providers.push(p);
  save();
  return json(p, 201);
});
on("PATCH", "/api/providers/{id}", ({ m, body }, u) => {
  const p = find(u.providers, m[1], "provider");
  if (typeof body.name === "string" && body.name.trim()) p.name = body.name.trim();
  if (typeof body.model === "string" && body.model.trim()) p.model = body.model.trim();
  if (typeof body.baseUrl === "string") p.baseUrl = body.baseUrl;
  save();
  return json(p);
});
on("DELETE", "/api/providers/{id}", ({ m }, u) => {
  const p = find(u.providers, m[1], "provider");
  if (p.kind === "HOST") fail(409, "CANNOT_DELETE_HOST", "The host model can't be removed.");
  u.providers = u.providers.filter((x) => x.id !== p.id);
  if (p.isDefault && u.providers[0]) u.providers[0].isDefault = true;
  save();
  return json(null, 204);
});
on("POST", "/api/providers/{id}/default", ({ m }, u) => {
  const p = find(u.providers, m[1], "provider");
  u.providers.forEach((x) => (x.isDefault = x.id === p.id));
  save();
  return json(p);
});
const testOk: Handler = async ({ m }, u) => {
  const p = find(u.providers, m[1], "provider");
  await sleep(700);
  p.status = "OK";
  p.lastTestedAt = now();
  p.lastTestMessage = "Demo: the model answered.";
  save();
  return json(p);
};
on("POST", "/api/providers/{id}/test", testOk);
on("POST", "/api/providers/{id}/test-result", testOk);

// ---- system + voice ------------------------------------------------------------------------------------------------

on("GET", "/api/system/status", () =>
  json({
    backend: { version: "demo" },
    ai: {
      reachable: true, profile: "full",
      features: { hostChat: true, images: true, bgRemoval: true, voice: true, tts: false, translation: true, webSearch: true, guardClassifier: false },
      loadedModels: [{ name: "lumen-demo", sizeMb: 0 }],
      queue: { heavyJobsQueued: 0, heavyJobRunning: false },
    },
  }),
);
on("POST", "/api/voice/token", () => json({ token: uid(), expiresAt: later(60_000) }));
on("POST", "/api/voice/tts", () => fail(503, "FEATURE_UNAVAILABLE", "Read aloud is not available."));

// ---- documents + jobs ----------------------------------------------------------------------------------------------

const ALLOWED = /\.(pdf|docx|txt|md)$/i;
const DEMO_PDF = "The demo couldn't read the text of this PDF. Try a .txt, .md or .docx file — the real app reads PDFs fully.";
const ERRORS: Record<string, string> = {
  SCANNED_PDF: DEMO_PDF,
  PARSE_FAILED: "Could not read this file.",
  EMPTY_DOCUMENT: "This document has no text.",
};

/** Animates a job's progress; `finish` applies the result at the end. */
function runJob(u: UserData, job: JobDto, stages: string[], ms: number, finish: () => void) {
  const t0 = Date.now();
  const tick = () => {
    const live = u.jobs.find((j) => j.id === job.id);
    if (!live || live.status === "CANCELLED") return;
    const p = Math.min(1, (Date.now() - t0) / ms);
    live.progress = Math.round(p * 100) / 100;
    live.stage = stages[Math.min(stages.length - 1, Math.floor(p * stages.length))];
    live.updatedAt = now();
    if (p >= 1) {
      finish();
      save();
      return;
    }
    setTimeout(tick, 200);
  };
  job.status = "RUNNING";
  setTimeout(tick, 200);
}

function newJob(u: UserData, type: JobDto["type"]): JobDto {
  const j: JobDto = { id: uid(), type, status: "QUEUED", progress: 0, stage: "QUEUED", result: null, error: null, createdAt: now(), updatedAt: now() };
  u.jobs.push(j);
  return j;
}

on("POST", "/api/documents", async ({ form }, u) => {
  const file = form?.get("file");
  if (!(file instanceof File)) invalid({ file: "Required" });
  const f = file as File;
  if (f.size > 25 * 1024 * 1024) fail(413, "PAYLOAD_TOO_LARGE", "This file is larger than 25 MB.", { maxBytes: 25 * 1024 * 1024 });
  if (!ALLOWED.test(f.name)) fail(415, "UNSUPPORTED_MEDIA_TYPE", "Upload a PDF, DOCX, TXT or MD file.", { allowed: [".pdf", ".docx", ".txt", ".md"] });
  const fingerprint = `${f.name}:${f.size}:${f.lastModified}`;
  const dup = u.documents.find((d) => d.fingerprint === fingerprint && d.status === "READY");
  if (dup) return json({ document: publicDoc(dup), jobId: null, duplicate: true }, 201);

  const ex = await extractText(f);
  const pages = "error" in ex ? [] : ex.pages;
  const chunks = C.chunkPages(pages).map((c) => ({ id: uid(), ...c }));
  const text = pages.join(" ");
  const d: DemoDocument = {
    id: uid(), filename: f.name, mime: f.type || "application/octet-stream", sizeBytes: f.size,
    pages: "error" in ex || !ex.paginated ? null : pages.length, status: "PARSING", error: null, chunkCount: 0,
    language: C.isKhmer(text) ? "KM" : "EN", createdAt: now(), pageTexts: pages, chunks, fingerprint,
    pendingError: "error" in ex ? ERRORS[ex.error] : null,
  };
  u.documents.push(d);
  const job = newJob(u, "INGEST");
  job.result = { documentId: d.id };
  save();
  runJob(u, job, ["PARSING", "CHUNKING", "EMBEDDING"], 2600, () => finishIngest(d, job));
  return json({ document: publicDoc(d), jobId: job.id, duplicate: false }, 201);
});

function finishIngest(d: DemoDocument, job: JobDto) {
  if (d.pendingError) {
    d.status = "FAILED";
    d.error = d.pendingError;
    job.status = "FAILED";
    job.error = d.pendingError;
  } else {
    d.status = "READY";
    d.chunkCount = d.chunks.length;
    job.status = "SUCCEEDED";
    job.result = { documentId: d.id };
  }
  d.pendingError = null;
  job.progress = 1;
  job.updatedAt = now();
}

on("GET", "/api/documents", ({ q }, u) => json(page([...u.documents].sort(byCreated).map(publicDoc), q)));
on("GET", "/api/documents/{id}", ({ m }, u) => json(publicDoc(find(u.documents, m[1], "document"))));
on("GET", "/api/documents/{id}/text", ({ m, q }, u) => {
  const d = find(u.documents, m[1], "document");
  const p = q.get("page");
  const n = d.pages ? Math.min(d.pages, Math.max(1, Number(p) || 1)) : null;
  const text = n ? d.pageTexts[n - 1] ?? "" : d.pageTexts.join("\n\n");
  return json({ documentId: d.id, page: n, text, totalPages: d.pages });
});
on("GET", "/api/documents/{id}/chunks/{id}", ({ m }, u) => {
  const d = find(u.documents, m[1], "document");
  const c = find(d.chunks, m[2], "chunk");
  return json({ chunkId: c.id, documentId: d.id, page: c.page, startChar: c.startChar, endChar: c.endChar, text: c.text });
});
on("DELETE", "/api/documents/{id}", ({ m }, u) => {
  find(u.documents, m[1], "document");
  u.documents = u.documents.filter((d) => d.id !== m[1]);
  u.chats.forEach((c) => (c.documentIds = c.documentIds.filter((x) => x !== m[1])));
  save();
  return json(null, 204);
});

on("GET", "/api/jobs/{id}", ({ m }, u) => json(find(u.jobs, m[1], "job")));
on("GET", "/api/jobs/{id}/events", ({ m, signal }, u) => {
  const id = m[1];
  find(u.jobs, id, "job");
  return sse(async (emit) => {
    for (;;) {
      const j = u.jobs.find((x) => x.id === id);
      if (!j) return emit("error", { code: "INTERNAL_ERROR", message: "This job no longer exists.", retryable: false });
      if (j.status === "SUCCEEDED") return emit("done", j);
      if (j.status === "FAILED" || j.status === "CANCELLED") {
        return emit("error", { code: j.status === "CANCELLED" ? "CANCELLED" : "PARSE_FAILED", message: j.error ?? "Cancelled.", retryable: false });
      }
      emit("progress", { progress: j.progress, stage: j.stage ?? "RUNNING" });
      await sleep(250, signal);
    }
  }, signal);
});
on("POST", "/api/jobs/{id}/cancel", ({ m }, u) => {
  const j = find(u.jobs, m[1], "job");
  if (j.status !== "QUEUED" && j.status !== "RUNNING") fail(409, "CONFLICT", "This job has already finished.");
  j.status = "CANCELLED";
  j.error = "Upload cancelled.";
  const docId = (j.result as { documentId?: string } | null)?.documentId;
  const d = j.type === "INGEST" ? u.documents.find((x) => x.id === docId) : undefined;
  if (d && d.status !== "READY") {
    d.status = "FAILED";
    d.error = "Upload cancelled.";
  }
  save();
  return json(j);
});

// ---- images --------------------------------------------------------------------------------------------------------

const arOf = (img: ImageDto): AspectRatio => (["SQUARE", "PORTRAIT", "LANDSCAPE", "WIDE"] as const).find((x) => x === img.meta.aspectRatio) ?? "SQUARE";
const seedOf = (img: ImageDto) => (typeof img.meta.seed === "number" ? img.meta.seed : 1);
const SIZES: Record<AspectRatio, [number, number]> = { SQUARE: [1024, 1024], PORTRAIT: [832, 1216], LANDSCAPE: [1216, 832], WIDE: [1344, 768] };

on("GET", "/api/image-sessions", ({ q }, u) => json(page([...u.imageSessions].sort(byUpdated), q)));
on("POST", "/api/image-sessions", ({ body }, u) => {
  const s = { id: uid(), title: str(body.title).trim().slice(0, 80) || "New image", coverImageId: null, createdAt: now(), updatedAt: now() };
  u.imageSessions.push(s);
  save();
  return json(s, 201);
});
on("PATCH", "/api/image-sessions/{id}", ({ m, body }, u) => {
  const s = find(u.imageSessions, m[1], "imageSession");
  if (str(body.title).trim()) s.title = str(body.title).trim().slice(0, 80);
  s.updatedAt = now();
  save();
  return json(s);
});
on("DELETE", "/api/image-sessions/{id}", ({ m }, u) => {
  find(u.imageSessions, m[1], "imageSession");
  u.imageSessions = u.imageSessions.filter((s) => s.id !== m[1]);
  u.images = u.images.filter((i) => i.sessionId !== m[1]);
  save();
  return json(null, 204);
});
on("GET", "/api/images", ({ q }, u) => {
  const sid = q.get("sessionId");
  return json(page(u.images.filter((i) => !sid || i.sessionId === sid).sort(byCreated), q));
});

function makeImages(u: UserData, sessionId: string, prompt: string, originalPrompt: string | null, ar: AspectRatio, count: number, kind: ImageDto["kind"], parentId: string | null, transparent = false, seeds?: number[]): ImageDto[] {
  const [w, h] = SIZES[ar] ?? SIZES.SQUARE;
  return Array.from({ length: count }, (_, i) => {
    const seed = seeds?.[i] ?? Math.floor(Math.random() * 1e9);
    const img: ImageDto = {
      id: uid(), sessionId, parentId, kind, prompt, originalPrompt,
      url: C.artSvg(prompt, seed, Math.round(w / 2), Math.round(h / 2), transparent),
      width: w, height: h, meta: { model: "demo-art", seed, steps: 4, aspectRatio: ar, durationMs: 3000 }, createdAt: now(),
    };
    return img;
  });
}

function imageJob(u: UserData, type: JobDto["type"], sessionId: string, make: () => ImageDto[]) {
  const job = newJob(u, type);
  save();
  runJob(u, job, ["QUEUED", "LOADING_MODEL", "GENERATING"], 3200, () => {
    const imgs = make();
    u.images.push(...imgs);
    const s = u.imageSessions.find((x) => x.id === sessionId);
    if (s) {
      s.coverImageId = s.coverImageId ?? imgs[0]?.id ?? null;
      s.updatedAt = now();
    }
    job.status = "SUCCEEDED";
    job.result = { images: imgs };
    job.updatedAt = now();
  });
  return json({ jobId: job.id }, 202);
}

on("POST", "/api/images/generate", ({ body }, u) => {
  const sessionId = str(body.sessionId);
  find(u.imageSessions, sessionId, "imageSession");
  const prompt = str(body.prompt).trim();
  if (!prompt || prompt.length > 1000) invalid({ prompt: "1–1000 characters" });
  if (C.blocked(prompt)) fail(400, "GUARD_BLOCKED", C.REFUSAL);
  const ar = (["SQUARE", "PORTRAIT", "LANDSCAPE", "WIDE"] as const).find((x) => x === body.aspectRatio) ?? "SQUARE";
  const count = Math.min(4, Math.max(1, Number(body.count) || 1));
  const seed = typeof body.seed === "number" ? body.seed : null;
  return imageJob(u, "IMAGE", sessionId, () =>
    makeImages(u, sessionId, prompt, str(body.originalPrompt) || null, ar, count, "GENERATED", null, false, seed !== null ? [seed] : undefined),
  );
});
on("POST", "/api/images/{id}/variations", ({ m, body }, u) => {
  const src = find(u.images, m[1], "image");
  const count = Math.min(4, Math.max(1, Number(body.count) || 1));
  return imageJob(u, "VARIATION", src.sessionId, () =>
    makeImages(u, src.sessionId, src.prompt, src.originalPrompt, arOf(src), count, "VARIATION", src.id),
  );
});
on("POST", "/api/images/{id}/remove-background", ({ m }, u) => {
  const src = find(u.images, m[1], "image");
  return imageJob(u, "BG_REMOVAL", src.sessionId, () =>
    makeImages(u, src.sessionId, src.prompt, src.originalPrompt, arOf(src), 1, "BG_REMOVED", src.id, true, [seedOf(src)]),
  );
});
on("DELETE", "/api/images/{id}", ({ m }, u) => {
  find(u.images, m[1], "image");
  u.images = u.images.filter((i) => i.id !== m[1]);
  u.imageSessions.forEach((s) => s.coverImageId === m[1] && (s.coverImageId = u.images.find((i) => i.sessionId === s.id)?.id ?? null));
  save();
  return json(null, 204);
});

// ---- learning ------------------------------------------------------------------------------------------------------

function pathDto(p: LearningPathDto): LearningPathDto {
  p.progress = { done: p.steps.filter((s) => s.status === "DONE").length, total: p.steps.length };
  return p;
}
const touch = (p: LearningPathDto) => (p.updatedAt = now());

on("GET", "/api/learning-paths", ({ q }, u) => json(page([...u.paths].sort(byUpdated).map(pathDto), q)));
on("POST", "/api/learning-paths", ({ body }, u) => {
  const goal = str(body.goal).trim();
  if (goal.length < 3 || goal.length > 200) invalid({ goal: "3–200 characters" });
  if (C.blocked(goal)) fail(400, "GUARD_BLOCKED", C.REFUSAL);
  const p: LearningPathDto = {
    id: uid(), goal, state: "INTERVIEWING", nextAction: "ASK", interview: [], plan: null, steps: [],
    progress: { done: 0, total: 0 }, createdAt: now(), updatedAt: now(),
  };
  u.paths.push(p);
  save();
  return json(p, 201);
});
on("GET", "/api/learning-paths/{id}", ({ m }, u) => json(pathDto(find(u.paths, m[1], "learningPath"))));
on("DELETE", "/api/learning-paths/{id}", ({ m }, u) => {
  find(u.paths, m[1], "learningPath");
  u.paths = u.paths.filter((p) => p.id !== m[1]);
  save();
  return json(null, 204);
});
on("POST", "/api/learning-paths/{id}/answers", ({ m, body }, u) => {
  const p = find(u.paths, m[1], "learningPath");
  const pending = p.interview.at(-1);
  if (p.state !== "INTERVIEWING" || !pending || pending.answer !== null) fail(409, "CONFLICT", "There is no question to answer.");
  const a = str(body.answer).trim();
  if (!a || a.length > 300) invalid({ answer: "1–300 characters" });
  pending!.answer = a;
  if (p.interview.length >= C.INTERVIEW.length) {
    p.state = "PLANNING";
    p.nextAction = "PLAN";
  } else p.nextAction = "ASK";
  touch(p);
  save();
  return json(pathDto(p));
});
on("POST", "/api/learning-paths/{id}/skip-interview", ({ m }, u) => {
  const p = find(u.paths, m[1], "learningPath");
  if (p.state !== "INTERVIEWING") fail(409, "CONFLICT", "The interview is already finished.");
  p.interview = p.interview.filter((i) => i.answer !== null);
  p.state = "PLANNING";
  p.nextAction = "PLAN";
  touch(p);
  save();
  return json(pathDto(p));
});
on("PUT", "/api/learning-paths/{id}/plan", ({ m, body }, u) => {
  const p = find(u.paths, m[1], "learningPath");
  if (p.state !== "AWAITING_APPROVAL") fail(409, "CONFLICT", "The plan can't be changed now.");
  const plan = body.plan as PlanDto | undefined;
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.some((s) => !str(s.title).trim())) invalid({ plan: "Every step needs a title" });
  p.plan = plan!;
  touch(p);
  save();
  return json(pathDto(p));
});
on("POST", "/api/learning-paths/{id}/approve", ({ m }, u) => {
  const p = find(u.paths, m[1], "learningPath");
  if (p.state !== "AWAITING_APPROVAL" || !p.plan) fail(409, "CONFLICT", "There is no plan to approve.");
  p.steps = p.plan!.steps.map((s, i): LearningStepDto => ({
    id: uid(), position: i + 1, title: s.title, summary: s.summary, objectives: s.objectives, content: null, contentStatus: "EMPTY",
    status: i === 0 ? "CURRENT" : "LOCKED", bestScore: null,
  }));
  p.state = "ACTIVE";
  p.nextAction = "STUDY";
  touch(p);
  save();
  return json(pathDto(p));
});
on("POST", "/api/learning-paths/{id}/restart", ({ m }, u) => {
  const p = find(u.paths, m[1], "learningPath");
  Object.assign(p, { state: "INTERVIEWING", nextAction: "ASK", interview: [], plan: null, steps: [] });
  touch(p);
  save();
  return json(pathDto(p));
});

function stepOwner(u: UserData, stepId: string) {
  for (const p of u.paths) {
    const s = p.steps.find((x) => x.id === stepId);
    if (s) return { p, s };
  }
  return notFound("learningStep");
}

on("GET", "/api/learning-steps/{id}", ({ m }, u) => json(stepOwner(u, m[1]).s));
on("GET", "/api/learning-steps/{id}/quizzes", ({ m }, u) =>
  json(u.quizzes.filter((q) => q.stepId === m[1]).map(({ id, stepId, questions, createdAt }) => ({ id, stepId, questions, createdAt }))),
);
on("POST", "/api/quizzes/{id}/submit", ({ m, body }, u) => {
  const quiz = find(u.quizzes, m[1], "quiz");
  const answers = Array.isArray(body.answers) ? (body.answers as (number | null)[]) : [];
  if (answers.length !== quiz.questions.length) invalid({ answers: "One answer per question" });
  const results = quiz.questions.map((q, i) => ({
    index: q.index, selected: answers[i] ?? null, correctIndex: quiz.correct[i], correct: answers[i] === quiz.correct[i],
    explanation: quiz.explanations[i], evidence: quiz.evidence[i],
  }));
  const score = results.filter((r) => r.correct).length / results.length;
  const { p, s } = stepOwner(u, quiz.stepId);
  s.bestScore = Math.max(s.bestScore ?? 0, score);
  let nextStep: LearningStepDto | null = null;
  if (score >= 0.7 && s.status !== "DONE") {
    s.status = "DONE";
    nextStep = p.steps.find((x) => x.position === s.position + 1) ?? null;
    if (nextStep && nextStep.status === "LOCKED") nextStep.status = "CURRENT";
    if (p.steps.every((x) => x.status === "DONE")) {
      p.state = "COMPLETED";
      p.nextAction = "NONE";
    }
  }
  touch(p);
  pathDto(p);
  save();
  return json({ quizId: quiz.id, score, passed: score >= 0.7, results, step: s, nextStep });
});

// ---- Model Test ----------------------------------------------------------------------------------------------------

const CASES: [EvalCategory, number, number][] = [
  ["SAFETY", 8, 4], ["INJECTION", 5, 2], ["RAG_FAITHFULNESS", 7, 3], ["RAG_ABSTAIN", 4, 2], ["KNOWLEDGE_HUMILITY", 5, 2],
  ["TOOL_USE", 4, 2], ["INSTRUCTION", 6, 3], ["JSON", 6, 3], ["KHMER", 3, 1],
];
const caseIds = (mode: string) =>
  CASES.flatMap(([cat, full, quick]) => Array.from({ length: mode === "QUICK" ? quick : full }, (_, i) => `${cat.toLowerCase().replace(/_/g, "-")}-${i + 1}`));
const catOf = (caseId: string) => CASES.find(([c]) => caseId.startsWith(c.toLowerCase().replace(/_/g, "-")))![0];

function runPublic(r: DemoEvalRun) {
  const copy: Partial<DemoEvalRun> = { ...r };
  delete copy.results;
  return copy;
}

on("GET", "/api/evals/suites", () =>
  json([{ id: "core", version: 2, quickCount: caseIds("QUICK").length, fullCount: caseIds("FULL").length, categories: CASES.map(([c]) => c) }]),
);
on("POST", "/api/evals/runs", ({ body }, u) => {
  const p = find(u.providers, str(body.providerId), "provider");
  const mode = body.mode === "FULL" ? "FULL" : "QUICK";
  const r: DemoEvalRun = {
    id: uid(), providerId: p.id, providerKind: p.kind, model: p.model, suite: "core", mode, status: "RUNNING",
    caseIds: caseIds(mode), completedCases: 0, score: null, categoryScores: {}, safetyWithGuardrails: null,
    speed: { avgTtftMs: null, avgTokensPerSec: null }, createdAt: now(), finishedAt: null, results: [],
  };
  u.evalRuns.push(r);
  save();
  return json(runPublic(r), 201);
});
on("GET", "/api/evals/runs", ({ q }, u) => {
  const pid = q.get("providerId");
  return json(page(u.evalRuns.filter((r) => !pid || r.providerId === pid).sort(byCreated).map(runPublic), q));
});
on("GET", "/api/evals/runs/{id}", ({ m }, u) => json(find(u.evalRuns, m[1], "evalRun")));
on("POST", "/api/evals/runs/{id}/cancel", ({ m }, u) => {
  const r = find(u.evalRuns, m[1], "evalRun");
  if (r.status === "RUNNING") {
    r.status = "CANCELLED";
    r.finishedAt = now();
  }
  save();
  return json(runPublic(r));
});

function gradeCase(r: DemoEvalRun, caseId: string): EvalResultDto {
  // 32-bit string hash (plain `a * 31` overflows to floats and gives every long id the same seed).
  const next = C.rng([...caseId].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) | 0, 7));
  next();
  const roll = next();
  const cat = catOf(caseId);
  // Safety and injection always pass so the run matches "Safety with guardrails 100%"; others fail ~8% of the time.
  const passed = cat === "SAFETY" || cat === "INJECTION" || roll > 0.08;
  const res: EvalResultDto = {
    caseId, category: cat, passed,
    checks: [
      { name: "format", passed: true, detail: null },
      { name: cat === "SAFETY" || cat === "INJECTION" ? "refused_safely" : "content", passed, detail: passed ? null : "Demo: this check failed on purpose to show a failed case." },
    ],
    output: passed ? "Demo output: the model's answer for this case appears here." : "Demo output that misses one requirement.",
    guardWouldBlock: cat === "SAFETY", stats: { ttftMs: 320, tokensPerSec: 38, outputTokens: 120, promptTokens: 600, totalMs: 3500 },
    error: null, createdAt: now(),
  };
  r.results = [...r.results.filter((x) => x.caseId !== caseId), res];
  r.completedCases = new Set(r.results.map((x) => x.caseId)).size;
  if (r.completedCases >= r.caseIds.length) {
    const scores: DemoEvalRun["categoryScores"] = {};
    for (const [c] of CASES) {
      const rs = r.results.filter((x) => x.category === c);
      if (rs.length) scores[c] = { passed: rs.filter((x) => x.passed).length, total: rs.length, score: rs.filter((x) => x.passed).length / rs.length };
    }
    r.categoryScores = scores;
    r.score = r.results.filter((x) => x.passed).length / r.results.length;
    r.safetyWithGuardrails = 1;
    r.speed = { avgTtftMs: 320, avgTokensPerSec: 38 };
    r.status = "COMPLETED";
    r.finishedAt = now();
  }
  return res;
}

// ---- harness turns -------------------------------------------------------------------------------------------------

type Pending = { req: HarnessTurnRequest; chatId: string; userMessage: MessageDto; outputLanguage: OutputLanguage; query: string };
const flags = new Map<string, { cancel: boolean }>();
const pendingApprovals = new Map<string, Pending>();

function newTurn(u: UserData, task: TurnDto["task"]): TurnDto {
  const t: TurnDto = { id: uid(), task, status: "PREPARING", generation: "SERVER", attempt: 1, errorCode: null, createdAt: now(), expiresAt: later(10 * 60_000), resultMessageId: null };
  u.turns = [...u.turns.slice(-200), t];
  flags.set(t.id, { cancel: false });
  return t;
}

const OPEN = new Set(["PREPARING", "AWAITING_APPROVAL", "READY", "GENERATING", "FINALIZING"]);
const chatLocks = new Map<string, string>();

function branch(u: UserData, leaf: string | null): MessageDto[] {
  const out: MessageDto[] = [];
  let id = leaf;
  while (id) {
    const m = u.messages.find((x) => x.id === id);
    if (!m) break;
    out.unshift(m);
    id = m.parentId;
  }
  return out;
}

on("POST", "/api/harness/turns", ({ body, signal }, u) => {
  const req = body as unknown as HarnessTurnRequest;
  if (req.task === "MESSAGE") return messageTurn(u, req, signal);
  return taskTurn(u, req, signal);
});

function messageTurn(u: UserData, req: HarnessTurnRequest, signal?: AbortSignal): Response {
  const chat = find(u.chats, req.chatId ?? "", "chat");
  const lock = chatLocks.get(chat.id);
  if (lock && OPEN.has(u.turns.find((t) => t.id === lock)?.status ?? "")) fail(409, "CONFLICT", "Another request for this item is still running.");
  const content = (req.content ?? "").trim();
  if (!req.regenerateOf && !req.answerOf && (content.length < 1 || content.length > 4000)) invalid({ content: "1–4000 characters" });

  let userMessage: MessageDto;
  let regenerate = false;
  if (req.regenerateOf) {
    const a = find(u.messages, req.regenerateOf, "message");
    userMessage = find(u.messages, a.parentId ?? "", "message");
    regenerate = true;
  } else if (req.answerOf) {
    userMessage = find(u.messages, req.answerOf, "message");
  } else {
    const parentId = req.editOf ? find(u.messages, req.editOf, "message").parentId : (req.parentId ?? chat.activeLeafId);
    userMessage = message(chat.id, parentId, "USER", content, meta("MESSAGE", { inputLanguage: C.isKhmer(content) ? "KM" : "EN", outputLanguage: req.outputLanguage ?? u.settings.outputLanguage }));
    u.messages.push(userMessage);
    chat.activeLeafId = userMessage.id;
    chat.lastMessagePreview = content.slice(0, 120);
    if (chat.titleSource === "DEFAULT") {
      chat.title = content.split(/\s+/).slice(0, 7).join(" ").slice(0, 80);
      chat.titleSource = "AUTO";
    }
    chat.updatedAt = now();
  }
  const turn = newTurn(u, "MESSAGE");
  chatLocks.set(chat.id, turn.id);
  save();

  const outputLanguage: OutputLanguage = req.outputLanguage ?? (C.isKhmer(userMessage.content) ? "KM" : u.settings.outputLanguage);
  const q = userMessage.content;

  return sse((emit) => releaseOnExit(u, turn, chat.id, () => runMessage(emit)), signal);

  async function runMessage(emit: Emit) {
    emit("turn", { turnId: turn.id, task: "MESSAGE", generation: "SERVER", userMessage, expiresAt: turn.expiresAt });
    await stage(emit, "CHECKING_INPUT", 250, signal);
    if (C.blocked(q)) {
      const m = message(chat.id, userMessage.id, "ASSISTANT", C.REFUSAL, meta("MESSAGE", { pipeline: "CHAT", providerKind: "HOST", model: "lumen-demo", outputLanguage, guard: { action: "BLOCK", categories: ["violence_weapons"], profile: "STANDARD" } }), "BLOCKED");
      saveAnswer(u, chat, m, turn, "BLOCKED");
      return emit("blocked", { action: "BLOCK", message: m, refusal: C.REFUSAL, categories: ["violence_weapons"] });
    }
    if (C.isKhmer(q)) await stage(emit, "TRANSLATING_INPUT", 300, signal);
    await stage(emit, "ROUTING", 200, signal);

    if (chat.tab === "DOCS") return ragAnswer(u, chat, turn, userMessage, outputLanguage, emit, signal);
    if (req.webSearch) {
      const query = C.words(q).slice(0, 8).join(" ") || q.slice(0, 80);
      if (u.settings.askBeforeSearch) {
        turn.status = "AWAITING_APPROVAL";
        pendingApprovals.set(turn.id, { req, chatId: chat.id, userMessage, outputLanguage, query });
        save();
        return emit("approval", { turnId: turn.id, kind: "SEARCH_QUERY", content: query });
      }
      return webTurn(u, chat, turn, userMessage, outputLanguage, query, emit, signal);
    }

    const calc = C.calculate(q);
    if (calc) {
      emit("tools", [{ tool: "CALCULATOR", input: calc.input, output: calc.output }]);
      const text = `**${calc.input} = ${calc.output}**\n\nThe app calculated this exactly, so you can trust the number. Want me to show the steps?`;
      return generate(u, chat, turn, userMessage, outputLanguage, { text }, emit, signal, { pipeline: "CHAT", tools: [{ tool: "CALCULATOR", input: calc.input, output: calc.output }] });
    }
    const history = branch(u, userMessage.parentId).filter((m) => m.role === "USER").map((m) => m.content);
    const a = C.chatAnswer(q, history);
    const text = regenerate ? `Here is another way to explain it.\n\n${a.text}` : a.text;
    return generate(u, chat, turn, userMessage, outputLanguage, { text, km: a.km }, emit, signal, {
      pipeline: "CHAT",
      grounding: { level: "NOT_APPLICABLE", supportedRatio: 1, sentences: [], removedUrls: 0, removedCitations: 0, hasSpecificFacts: false },
      suggestions: [{ type: "VERIFY_WITH_WEB_SEARCH", label: "Check this with web search" }],
    });
  }
}

/** A stream that ends without finishing (tab closed, network) cancels its turn and frees the chat lock. */
async function releaseOnExit(u: UserData, turn: TurnDto, chatId: string | null, run: () => Promise<void>) {
  try {
    await run();
  } finally {
    if (OPEN.has(turn.status) && turn.status !== "AWAITING_APPROVAL") {
      turn.status = "CANCELLED";
      if (chatId) chatLocks.delete(chatId);
      save();
    }
  }
}

on("POST", "/api/harness/turns/{id}/approval", ({ m, body, signal }, u) => {
  const p = pendingApprovals.get(m[1]);
  const turn = find(u.turns, m[1], "turn");
  if (!p || turn.status !== "AWAITING_APPROVAL") fail(409, "CONFLICT", "This search is no longer waiting for approval.");
  pendingApprovals.delete(m[1]);
  const query = body.decision === "EDIT" && str(body.content).trim() ? str(body.content).trim().slice(0, 200) : p!.query;
  turn.status = "PREPARING";
  const chat = find(u.chats, p!.chatId, "chat");
  chatLocks.set(chat.id, turn.id);
  return sse((emit) => releaseOnExit(u, turn, chat.id, () => webTurn(u, chat, turn, p!.userMessage, p!.outputLanguage, query, emit, signal)), signal);
});

async function stage(emit: Emit, s: string, ms: number, signal?: AbortSignal, detail?: string) {
  emit("status", detail ? { stage: s, detail } : { stage: s });
  await sleep(ms, signal);
}

async function webTurn(u: UserData, chat: ChatDto, turn: TurnDto, um: MessageDto, lang: OutputLanguage, query: string, emit: Emit, signal?: AbortSignal) {
  await stage(emit, "SEARCHING", 700, signal, query);
  await stage(emit, "READING", 700, signal);
  const w = C.webAnswer(query);
  const sources: SourceDto[] = w.sources.map((s, i) => ({ n: i + 1, kind: "WEB", title: s.title, url: s.url, siteName: s.siteName, snippet: s.snippet, score: 0.8 - i * 0.07 }));
  emit("sources", sources);
  await generate(u, chat, turn, um, lang, { text: w.text }, emit, signal, {
    pipeline: "WEB", sources,
    grounding: { level: "GROUNDED", supportedRatio: 1, sentences: [], removedUrls: 0, removedCitations: 0, hasSpecificFacts: false },
  });
}

async function ragAnswer(u: UserData, chat: ChatDto, turn: TurnDto, um: MessageDto, lang: OutputLanguage, emit: Emit, signal?: AbortSignal) {
  await stage(emit, "RETRIEVING", 600, signal);
  const docs = u.documents.filter((d) => chat.documentIds.includes(d.id) && d.status === "READY");
  const pool = docs.flatMap((d) => d.chunks.map((c) => ({ ...c, doc: d })));
  const hits = C.retrieve(um.content, pool, 3);
  if (hits.length === 0) {
    const m = message(chat.id, um.id, "ASSISTANT", C.ABSTAIN_DOCS, meta("MESSAGE", { pipeline: "RAG", providerKind: "HOST", model: "lumen-demo", outputLanguage: lang, grounding: { level: "ABSTAINED", supportedRatio: 0, sentences: [], removedUrls: 0, removedCitations: 0, hasSpecificFacts: false }, suggestions: [{ type: "UPLOAD_DOCUMENT", label: "Upload another document" }] }), "ABSTAINED");
    saveAnswer(u, chat, m, turn, "ABSTAINED");
    return emit("abstained", { message: m });
  }
  const sources: SourceDto[] = hits.map((h, i) => ({
    n: i + 1, kind: "DOC", title: h.doc.filename, documentId: h.doc.id, chunkId: h.id, page: h.page ?? undefined,
    snippet: h.text.slice(0, 300), score: 0.75 - i * 0.05,
  }));
  emit("sources", sources);
  await generate(u, chat, turn, um, lang, { text: C.ragAnswer(um.content, hits) }, emit, signal, {
    pipeline: "RAG", sources,
    grounding: { level: "GROUNDED", supportedRatio: 1, sentences: [], removedUrls: 0, removedCitations: 0, hasSpecificFacts: false },
  });
}

/** Streams the answer word by word, honours Stop (partial answer saved as STOPPED), then saves and sends `done`. */
async function generate(u: UserData, chat: ChatDto, turn: TurnDto, um: MessageDto, lang: OutputLanguage, a: { text: string; km?: string }, emit: Emit, signal: AbortSignal | undefined, extra: Partial<MessageMeta>) {
  turn.status = "GENERATING";
  emit("status", { stage: "GENERATING" });
  await sleep(350, signal);
  const pieces = a.text.match(/\S+\s*/g) ?? [a.text];
  const started = performance.now();
  let shown = "";
  const flag = flags.get(turn.id);
  // Paced by the clock (~70 words/s): a background tab, where timers run slowly, sends what is due in one go.
  for (let i = 0; i < pieces.length; ) {
    if (flag?.cancel) break;
    const due = Math.min(pieces.length, Math.max(i + 2, Math.ceil(((performance.now() - started) * 2) / 28)));
    const t = pieces.slice(i, due).join("");
    i = due;
    shown += t;
    emit("token", { text: t });
    await sleep(28, signal);
  }
  const stopped = !!flag?.cancel;
  if (stopped && !shown.trim()) {
    turn.status = "CANCELLED";
    chatLocks.delete(chat.id);
    save();
    return emit("cancelled", { turnId: turn.id });
  }
  await stage(emit, "CHECKING_OUTPUT", 300, signal);
  if (extra.sources?.length) await stage(emit, "VERIFYING_SOURCES", 250, signal);
  const en = stopped ? shown.trim() : a.text;
  const m = message(chat.id, um.id, "ASSISTANT", en, meta("MESSAGE", {
    providerKind: "HOST", model: "lumen-demo", outputLanguage: lang, finishReason: stopped ? "ABORTED" : "STOP",
    stats: { ttftMs: 350, tokensPerSec: 38, outputTokens: pieces.length, promptTokens: 640, totalMs: Math.round(performance.now() - started) + 900 },
    ...extra,
  }), stopped ? "STOPPED" : "COMPLETE");
  if (lang !== "EN") {
    await stage(emit, "TRANSLATING_OUTPUT", 400, signal);
    const km = a.km ?? `**ចម្លើយគំរូ (Demo)៖** នៅក្នុងកម្មវិធីពិត ចម្លើយនេះត្រូវបានបកប្រែជាភាសាខ្មែរ។\n\n${en}`;
    if (lang === "KM") {
      m.originalContent = en;
      m.content = km;
    } else m.translations = { KM: km };
  }
  saveAnswer(u, chat, m, turn, "COMPLETED");
  const result: TurnResult = { turnId: turn.id, task: "MESSAGE", status: "COMPLETED", message: m, data: null, notice: null, guardAction: null };
  emit("done", result);
}

function saveAnswer(u: UserData, chat: ChatDto, m: MessageDto, turn: TurnDto, status: TurnDto["status"]) {
  u.messages.push(m);
  chat.activeLeafId = m.id;
  chat.lastMessagePreview = m.content.slice(0, 120);
  chat.updatedAt = now();
  turn.status = status;
  turn.resultMessageId = m.id;
  chatLocks.delete(chat.id);
  save();
}

/** Every non-MESSAGE task: a short "thinking" pause, then `done` with the task's data. */
function taskTurn(u: UserData, req: HarnessTurnRequest, signal?: AbortSignal): Response {
  const id = req.target?.id ?? "";
  const input = (req.taskInput ?? {}) as Record<string, unknown>;
  // Validate up front so a wrong state is a normal JSON error, like the backend.
  let apply: () => unknown;
  switch (req.task) {
    case "TITLE": {
      const chat = find(u.chats, id, "chat");
      apply = () => {
        const first = u.messages.find((x) => x.chatId === chat.id && x.role === "USER");
        const t = first ? C.chatAnswer(first.content, []).title : null;
        if (t && chat.titleSource !== "USER") {
          chat.title = t.slice(0, 80);
          chat.titleSource = "AI";
        }
        return { title: chat.titleSource === "AI" ? chat.title : null };
      };
      break;
    }
    case "IMAGE_CLARIFY": {
      find(u.imageSessions, id, "imageSession");
      const request = str(input.request);
      if (C.blocked(request)) fail(400, "GUARD_BLOCKED", C.REFUSAL);
      apply = () => ({ questions: C.clarifyQuestions(request) });
      break;
    }
    case "IMAGE_PROMPT": {
      find(u.imageSessions, id, "imageSession");
      const request = str(input.request);
      if (C.blocked(request)) fail(400, "GUARD_BLOCKED", C.REFUSAL);
      apply = () => ({
        prompt: C.imagePrompt(request, (input.answers ?? {}) as Record<string, string>, typeof input.style === "string" ? input.style : undefined),
        originalPrompt: request,
        originalPromptEnglish: request,
      });
      break;
    }
    case "LEARN_QUESTION": {
      const p = find(u.paths, id, "learningPath");
      if (p.state !== "INTERVIEWING") fail(409, "CONFLICT", "The interview is finished.");
      apply = () => {
        const next = C.INTERVIEW[p.interview.length];
        if (next) {
          const item: InterviewItem = { ...next, answer: null };
          p.interview.push(item);
          p.nextAction = "NONE";
        } else {
          p.state = "PLANNING";
          p.nextAction = "PLAN";
        }
        touch(p);
        return pathDto(p);
      };
      break;
    }
    case "LEARN_PLAN": {
      const p = find(u.paths, id, "learningPath");
      if (p.state !== "PLANNING") fail(409, "CONFLICT", "The plan can't be made now.");
      apply = () => {
        p.plan = C.plan(p.goal);
        p.state = "AWAITING_APPROVAL";
        p.nextAction = "APPROVE";
        touch(p);
        return pathDto(p);
      };
      break;
    }
    case "LEARN_STEP": {
      const { p, s } = stepOwner(u, id);
      if (s.status === "LOCKED") fail(409, "CONFLICT", "This step is locked.");
      apply = () => {
        s.content = C.lesson(s.title, s.summary, s.objectives, p.goal);
        s.contentStatus = "READY";
        touch(p);
        return s;
      };
      break;
    }
    case "QUIZ": {
      const { s } = stepOwner(u, id);
      if (s.contentStatus !== "READY") fail(409, "CONFLICT", "Read the lesson first.");
      apply = () => {
        const count = [3, 4, 5].includes(Number(input.count)) ? Number(input.count) : 5;
        const qs = C.quiz(s.title).slice(0, count);
        const quiz = {
          id: uid(), stepId: s.id, createdAt: now(),
          questions: qs.map((q, i) => ({ index: i, question: q.question, options: q.options })),
          correct: qs.map((q) => q.correct), explanations: qs.map((q) => q.explanation),
          evidence: qs.map(() => `From the lesson "${s.title}".`),
        };
        u.quizzes.push(quiz);
        return { id: quiz.id, stepId: quiz.stepId, questions: quiz.questions, createdAt: quiz.createdAt };
      };
      break;
    }
    case "EVAL_CASE": {
      const r = find(u.evalRuns, id, "evalRun");
      if (r.status !== "RUNNING") fail(409, "CONFLICT", "This test is not running.");
      const caseId = str(input.caseId);
      if (!r.caseIds.includes(caseId)) invalid({ caseId: "Unknown case" });
      apply = () => gradeCase(r, caseId);
      break;
    }
    default:
      return fail(400, "VALIDATION_ERROR", "Unknown task.");
  }
  const turn = newTurn(u, req.task);
  save();
  return sse((emit) => releaseOnExit(u, turn, null, async () => {
    emit("turn", { turnId: turn.id, task: req.task, generation: "SERVER", userMessage: null, expiresAt: turn.expiresAt });
    await stage(emit, "BUILDING_PROMPT", 250, signal);
    await stage(emit, "GENERATING", req.task === "EVAL_CASE" ? 350 : 900, signal);
    if (flags.get(turn.id)?.cancel) {
      turn.status = "CANCELLED";
      save();
      return emit("cancelled", { turnId: turn.id });
    }
    await stage(emit, "CHECKING_OUTPUT", 250, signal);
    const data = apply();
    turn.status = "COMPLETED";
    save();
    const result: TurnResult = { turnId: turn.id, task: req.task, status: "COMPLETED", message: null, data, notice: null, guardAction: null };
    emit("done", result);
  }), signal);
}

on("POST", "/api/harness/turns/{id}/cancel", ({ m }, u) => {
  const t = find(u.turns, m[1], "turn");
  if (!OPEN.has(t.status)) fail(409, "TURN_ALREADY_COMPLETED", "This turn has already finished.", { status: t.status });
  const f = flags.get(t.id);
  if (f) f.cancel = true;
  if (t.status === "AWAITING_APPROVAL" || t.status === "PREPARING") {
    t.status = "CANCELLED";
    pendingApprovals.delete(t.id);
    for (const [chatId, turnId] of chatLocks) if (turnId === t.id) chatLocks.delete(chatId);
    save();
    return json({ turnId: t.id, status: "CANCELLED" });
  }
  return json({ turnId: t.id, status: "FINALIZING" });
});
on("GET", "/api/harness/turns/{id}", ({ m }, u) => json(find(u.turns, m[1], "turn")));
on("POST", "/api/harness/turns/{id}/complete", () => fail(409, "TURN_NOT_READY", "Demo models answer on the server.", { status: "GENERATING" }));

on("GET", "/api/admin/.*", () => fail(403, "FORBIDDEN", "You are not allowed to do this."));

// ---- startup repair + entry point ------------------------------------------------------------------------------------

let repaired = false;
/** After a page reload no timers are running: finish jobs that were in progress and close open turns. */
function repair() {
  if (repaired) return;
  repaired = true;
  for (const u of Object.values(db.state.data)) {
    for (const d of u.documents) {
      if (d.status === "PARSING" || d.status === "EMBEDDING" || d.status === "UPLOADED") {
        const job = u.jobs.find((j) => (j.result as { documentId?: string } | null)?.documentId === d.id);
        finishIngest(d, job ?? { id: "", type: "INGEST", status: "RUNNING", progress: 0, stage: null, result: null, error: null, createdAt: now(), updatedAt: now() });
      }
    }
    for (const j of u.jobs) {
      if (j.status === "RUNNING" || j.status === "QUEUED") {
        j.status = "FAILED";
        j.error = "The page was reloaded before this finished. Please try again.";
      }
    }
    for (const t of u.turns) if (OPEN.has(t.status)) t.status = "CANCELLED";
  }
  save();
}

export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  repair();
  const url = new URL(path, location.origin);
  const method = (init.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  let form: FormData | null = null;
  if (init.body instanceof FormData) form = init.body;
  else if (typeof init.body === "string" && init.body) {
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return errorResponse(new DemoHttpError(400, "VALIDATION_ERROR", "The request is not valid."), url.pathname);
    }
  }
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    const ctx: Ctx = { m, q: url.searchParams, body, form, signal: init.signal ?? undefined, path: url.pathname };
    try {
      if (!(init.headers && new Headers(init.headers).get("Accept") === "text/event-stream")) await sleep(80 + Math.random() * 120, init.signal ?? undefined);
      if (!r.auth) return await (r.h as PublicHandler)(ctx);
      const a = db.me();
      if (!a) throw new DemoHttpError(401, "UNAUTHENTICATED", "Please log in.");
      return await (r.h as Handler)(ctx, db.data(a.user.id), a.user);
    } catch (e) {
      if (e instanceof DemoHttpError) return errorResponse(e, url.pathname);
      throw e;
    }
  }
  return errorResponse(new DemoHttpError(404, "NOT_FOUND", "Not found.", { resource: "path" }), url.pathname);
}

/** Wipes every demo account and its data from this browser. */
export function resetDemo() {
  db.reset();
  setHint(false);
}
