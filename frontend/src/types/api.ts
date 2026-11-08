/** Exact JSON shapes of the backend API (docs/API_CONTRACT.md §4). Do not edit by hand without the contract. */

export type UUID = string;
export type Instant = string;

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export type Role = "USER" | "ADMIN";
export type Theme = "LIGHT" | "DARK" | "SYSTEM";
export type UiLanguage = "EN" | "KM";
export type OutputLanguage = "EN" | "KM" | "BOTH";
export type InputLanguage = "EN" | "KM" | "MIXED" | "OTHER";
export type AnswerLength = "SHORT" | "NORMAL" | "DETAILED";
export type GuardProfile = "STANDARD" | "STRICT" | "TEST";
export type Tab = "CHAT" | "DOCS";
export type MessageRole = "USER" | "ASSISTANT";
export type MessageStatus = "COMPLETE" | "STOPPED" | "BLOCKED" | "ABSTAINED";
export type ProviderKind = "HOST" | "BROWSER" | "LOCAL_OLLAMA" | "REMOTE_URL";
export type GenerationSide = "SERVER" | "CLIENT";
export type Task =
  | "MESSAGE" | "TITLE" | "IMAGE_CLARIFY" | "IMAGE_PROMPT" | "LEARN_QUESTION" | "LEARN_PLAN" | "LEARN_STEP"
  | "QUIZ" | "EVAL_CASE";
export type Pipeline = "CHAT" | "RAG" | "WEB";
export type TurnStatus =
  | "PREPARING" | "AWAITING_APPROVAL" | "READY" | "GENERATING" | "FINALIZING"
  | "COMPLETED" | "BLOCKED" | "ABSTAINED" | "CANCELLED" | "EXPIRED" | "FAILED";
export type TurnStage =
  | "CHECKING_INPUT" | "TRANSLATING_INPUT" | "ROUTING" | "RETRIEVING" | "SEARCHING" | "READING"
  | "BUILDING_PROMPT" | "QUEUED" | "GENERATING" | "CHECKING_OUTPUT" | "VERIFYING_SOURCES"
  | "TRANSLATING_OUTPUT" | "SAVING";
export type FinishReason = "STOP" | "LENGTH" | "ABORTED" | "GUARD_STOP" | "LOOP_STOP";
export type GroundingLevel = "GROUNDED" | "PARTIAL" | "UNGROUNDED" | "ABSTAINED" | "NOT_APPLICABLE";
export type SentenceIssue = "NO_CITATION" | "INVALID_CITATION" | "LOW_SUPPORT" | "NUMBER_NOT_IN_SOURCE" | "QUOTE_NOT_IN_SOURCE";
export type GuardAction = "ALLOW" | "FLAG" | "SAFE_COMPLETE" | "SUPPORT" | "REPLACE" | "BLOCK";
export type SuggestionType =
  | "TURN_ON_WEB_SEARCH" | "VERIFY_WITH_WEB_SEARCH" | "OPEN_IMAGE_TAB" | "START_LEARNING_PATH"
  | "UPLOAD_DOCUMENT" | "ASK_MY_DOCUMENTS" | "SWITCH_TO_HOST_MODEL";
export type ProviderStatus = "UNTESTED" | "OK" | "FAILED";

export interface UserDto { id: UUID; name: string; email: string; role: Role; createdAt: Instant; }

export interface SettingsDto {
  theme: Theme;
  uiLanguage: UiLanguage;
  outputLanguage: OutputLanguage;
  answerLength: AnswerLength;
  temperature: number | null;
  askBeforeSearch: boolean;
  guardProfile: "STANDARD" | "STRICT";
  timezone: string;
  showSpeedStats: boolean;
  defaultProviderId: UUID | null;
}

export interface AuthResponse { user: UserDto; settings: SettingsDto; accessToken: string; accessTokenExpiresAt: Instant; }
export interface MeResponse { user: UserDto; settings: SettingsDto; }

export interface ChatDto {
  id: UUID;
  tab: Tab;
  title: string;
  titleSource: "DEFAULT" | "AUTO" | "AI" | "USER";
  documentIds: UUID[];
  activeLeafId: UUID | null;
  lastMessagePreview: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface SourceDto {
  n: number;
  kind: "DOC" | "WEB";
  title: string;
  documentId?: UUID;
  chunkId?: UUID;
  page?: number;
  url?: string;
  siteName?: string;
  publishedAt?: string;
  snippet: string;
  score: number;
}

export interface SentenceReport {
  index: number;
  start: number;
  end: number;
  citations: number[];
  supported: boolean;
  issue?: SentenceIssue;
}

export interface GroundingReport {
  level: GroundingLevel;
  supportedRatio: number;
  sentences: SentenceReport[];
  removedUrls: number;
  removedCitations: number;
  hasSpecificFacts: boolean;
}

export interface ToolResultDto { tool: "CALCULATOR" | "DATETIME"; input: string; output: string; }
export interface SuggestionDto { type: SuggestionType; label: string; payload?: Record<string, string>; }
export interface GuardSummary { action: GuardAction; categories: string[]; profile: GuardProfile; }
export interface GenerationStats {
  ttftMs: number | null;
  tokensPerSec: number | null;
  outputTokens: number | null;
  promptTokens: number | null;
  totalMs: number | null;
}

export interface MessageMeta {
  task: Task;
  pipeline: Pipeline | null;
  providerKind: ProviderKind | null;
  model: string | null;
  outputLanguage: OutputLanguage;
  inputLanguage: InputLanguage | null;
  sources: SourceDto[];
  grounding: GroundingReport | null;
  guard: GuardSummary | null;
  tools: ToolResultDto[];
  suggestions: SuggestionDto[];
  stats: GenerationStats | null;
  finishReason: FinishReason | null;
  feedback: { rating: 1 | -1; reason: string | null } | null;
}

export interface MessageDto {
  id: UUID;
  chatId: UUID;
  parentId: UUID | null;
  role: MessageRole;
  content: string;
  originalContent: string | null;
  translations: { EN?: string; KM?: string };
  status: MessageStatus;
  meta: MessageMeta;
  createdAt: Instant;
}

export interface ChatMessagesResponse { chatId: UUID; activeLeafId: UUID | null; messages: MessageDto[]; }

export interface ModelProfile {
  family: string;
  contextWindow: number;
  systemRole: boolean;
  jsonSchema: boolean;
  thinking: "NONE" | "TAGS" | "FIELD";
  disableThinking: "NONE" | "OLLAMA_THINK_FALSE" | "NO_THINK_SUFFIX" | "WEBLLM_EXTRA_BODY";
  khmerNative: boolean;
  maxOutputTokens: number;
  topP: number;
  repeatPenalty: number;
  tokenFactor: number;
}

export interface ProviderDto {
  id: UUID;
  name: string;
  kind: ProviderKind;
  generation: GenerationSide;
  baseUrl: string | null;
  model: string;
  hasApiKey: boolean;
  isDefault: boolean;
  status: ProviderStatus;
  lastTestedAt: Instant | null;
  lastTestMessage: string | null;
  modelProfile: ModelProfile;
  features: { chat: boolean; documents: boolean; webSearch: boolean; learning: boolean; images: boolean };
  createdAt: Instant;
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

export interface GenParams {
  temperature: number;
  topP: number;
  maxTokens: number;
  stop: string[];
  repeatPenalty: number;
  minP: number | null;
  seed: number | null;
  numCtx: number;
}

export interface LoopConfig {
  windowChars: number; minRepeatLen: number; maxRepeatLen: number; repeatLenStep: number;
  maxRepeats: number; checkEveryChars: number; sameLineRepeats: number; sameLineMinChars: number;
}
export interface ClientGuardConfig { stopPatterns: string[]; maxOutputChars: number; loop: LoopConfig; }

export interface HarnessTurnRequest {
  task: Task;
  providerId: UUID;
  chatId?: UUID;
  content?: string;
  parentId?: UUID;
  regenerateOf?: UUID;
  editOf?: UUID;
  answerOf?: UUID;
  webSearch?: boolean;
  outputLanguage?: OutputLanguage;
  target?: { type: "CHAT" | "IMAGE_SESSION" | "LEARNING_PATH" | "LEARNING_STEP" | "EVAL_RUN"; id: UUID };
  taskInput?: Record<string, unknown>;
}

export interface TurnStartedEvent { turnId: UUID; task: Task; generation: GenerationSide; userMessage: MessageDto | null; expiresAt: Instant; }
export interface RetryEvent { attempt: number; reason: "INVALID" | "EMPTY"; }
export interface StatusEvent { stage: TurnStage; detail?: string; }
export interface ApprovalEvent { turnId: UUID; kind: "SEARCH_QUERY"; content: string; }
export interface BlockedEvent { action: "BLOCK" | "SUPPORT"; message: MessageDto | null; refusal: string; categories: string[]; }
export interface AbstainedEvent { message: MessageDto; }
export interface PreparedEvent {
  turnId: UUID;
  messages: ChatMessage[];
  params: GenParams;
  outputSchema: object | null;
  modelProfile: ModelProfile;
  clientGuard: ClientGuardConfig;
  attempt: number;
}
export interface TokenEvent { text: string; }
export interface TurnResult {
  turnId: UUID;
  task: Task;
  status: "COMPLETED" | "BLOCKED" | "ABSTAINED" | "CANCELLED" | "FAILED";
  message: MessageDto | null;
  data: unknown | null;
  notice: string | null;
  guardAction: "BLOCK" | "REPLACE" | "SUPPORT" | null;
}
export interface ErrorEvent { code: string; message: string; retryable: boolean; }

export interface CompleteTurnRequest {
  content: string;
  finishReason: FinishReason;
  stats: GenerationStats & { model: string };
  attempt: number;
}

export interface TurnDto {
  id: UUID; task: Task; status: TurnStatus; generation: GenerationSide; attempt: number; errorCode: string | null;
  createdAt: Instant; expiresAt: Instant; resultMessageId: UUID | null;
}
export interface CancelTurnRequest { reason?: "USER" | "CLIENT_ERROR"; errorCode?: string; }
export interface CancelTurnResponse { turnId: UUID; status: TurnStatus; }

export interface BrowserModelDto {
  id: string;
  fallbackId: string;
  label: string;
  vramMb: number;
  fallbackVramMb: number;
  recommended: boolean;
}
export interface ProviderCatalogDto {
  host: { available: boolean; models: string[] };
  browser: { models: BrowserModelDto[] };
  ollamaSuggestions: { tag: string; label: string; sizeGb: number; note: string }[];
}
export interface CreateProviderRequest {
  name: string;
  kind: "BROWSER" | "LOCAL_OLLAMA" | "REMOTE_URL";
  baseUrl?: string | null;
  model: string;
  apiKey?: string;
  makeDefault?: boolean;
}
export interface ProviderTestCheck { name: string; ok: boolean; message: string | null; }
export interface ProviderModelInfo {
  name: string; family?: string; parameterSize?: string; quantization?: string; contextLength?: number;
}
export interface ProviderTestResultRequest { ok: boolean; checks: ProviderTestCheck[]; modelInfo?: ProviderModelInfo; }
