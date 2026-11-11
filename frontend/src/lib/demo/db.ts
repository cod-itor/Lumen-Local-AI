import type {
  ChatDto,
  DocumentDto,
  EvalResultDto,
  EvalRunDto,
  ImageDto,
  ImageSessionDto,
  JobDto,
  LearningPathDto,
  MessageDto,
  ProjectDto,
  ProviderDto,
  QuizDto,
  SettingsDto,
  TurnDto,
  UserDto,
} from "@/types/api";

/**
 * The demo's "database": one JSON object in localStorage. Every record belongs to one demo account; nothing leaves
 * the browser. Passwords are kept only so sign-in behaves like the real app (demo accounts, never real secrets).
 */
export type DemoChunk = { id: string; page: number | null; startChar: number; endChar: number; text: string };
export type DemoDocument = DocumentDto & { pageTexts: string[]; chunks: DemoChunk[]; fingerprint: string; pendingError?: string | null };
export type DemoQuiz = QuizDto & { correct: number[]; explanations: string[]; evidence: string[] };
export type DemoEvalRun = EvalRunDto & { results: EvalResultDto[] };

export type UserData = {
  settings: SettingsDto;
  chats: ChatDto[];
  messages: MessageDto[];
  projects: ProjectDto[];
  providers: ProviderDto[];
  documents: DemoDocument[];
  jobs: JobDto[];
  imageSessions: ImageSessionDto[];
  images: ImageDto[];
  paths: LearningPathDto[];
  quizzes: DemoQuiz[];
  evalRuns: DemoEvalRun[];
  turns: TurnDto[];
};

type Account = { user: UserDto; password: string };
type DemoState = { version: 1; accounts: Account[]; sessionUserId: string | null; data: Record<string, UserData> };

const KEY = "lumen-demo-v1";
let state: DemoState | null = null;

function blank(): DemoState {
  return { version: 1, accounts: [], sessionUserId: null, data: {} };
}

function load(): DemoState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as DemoState) : null;
    state = parsed?.version === 1 ? parsed : blank();
  } catch {
    state = blank();
  }
  return state;
}

/** Writes the whole store. Quota errors (big uploads) are ignored: the data still lives in memory for this tab. */
export function save() {
  if (!state) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: keep working in memory
  }
}

export const db = {
  get state() {
    return load();
  },
  accountByEmail(email: string) {
    return load().accounts.find((a) => a.user.email === email.trim().toLowerCase()) ?? null;
  },
  addAccount(a: Account, data: UserData) {
    const s = load();
    s.accounts.push(a);
    s.data[a.user.id] = data;
    save();
  },
  removeAccount(id: string) {
    const s = load();
    s.accounts = s.accounts.filter((a) => a.user.id !== id);
    delete s.data[id];
    if (s.sessionUserId === id) s.sessionUserId = null;
    save();
  },
  /** The signed-in account, or null. */
  me(): Account | null {
    const s = load();
    return s.accounts.find((a) => a.user.id === s.sessionUserId) ?? null;
  },
  setSession(id: string | null) {
    load().sessionUserId = id;
    save();
  },
  data(userId: string): UserData {
    return load().data[userId];
  },
  /** Clears everything the demo stored in this browser. */
  reset() {
    state = blank();
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
