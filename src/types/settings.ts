/**
 * Settings → AI & models. Lumen does not host AI: every model runs on the
 * user's own computer (via Ollama). These types describe which installed
 * model does which job, and the rules Lumen wraps around them.
 */

export type ModelRoleId = "chat" | "rag" | "image";
export type ModelState = "ready" | "downloading" | "missing";

export type InstalledModel = {
  id: string; // Ollama tag, e.g. "gemma4:e2b"
  name: string; // "Gemma 4 E2B"
  role: ModelRoleId | "embedding";
  size: string; // "3.2 GB"
  state: ModelState;
  progress?: number; // 0–100 while downloading
  capabilities: string[];
};

export type ModelRole = {
  id: ModelRoleId;
  title: string;
  job: string;
  usedIn: string[];
  icon: string;
  /** Model ids (InstalledModel.id) currently assigned. RAG has an embedding + answer model. */
  slots: { label: string; modelId: string; accepts: InstalledModel["role"]; why: string }[];
  requirements: string[];
  pipeline?: string[];
  tools?: { name: string; when: string }[];
  install: string[];
  alternatives: { name: string; note: string }[];
};

export type GuardrailGroup = {
  id: string;
  title: string;
  appliesTo: string;
  icon: string;
  rules: { title: string; detail: string }[];
};

export type PrivacyRow = { feature: string; runsOn: string; leaves: string; level: "none" | "some" | "planned" };

export type AiSettingsContent = {
  runtime: { name: string; host: string; version: string; connected: boolean };
  explainer: { title: string; body: string; points: { title: string; detail: string }[] };
  roles: ModelRole[];
  installed: InstalledModel[];
  setup: { title: string; detail: string; command?: string }[];
  hardware: { label: string; value: string }[];
  guardrails: GuardrailGroup[];
  guardrailNote: string;
  privacy: PrivacyRow[];
};
