import "server-only";
import {
  mockDocumentChats,
  mockDocumentThreads,
  mockMaterialPages,
  mockMaterials,
} from "@/mocks/documents";
import type {
  DocumentChatSummary,
  DocumentThread,
  Material,
  MaterialPage,
} from "@/types/documents";

// Swap each body for `apiFetch(...)` (see ./api.ts) when the backend is ready.

export async function getMaterials(): Promise<Material[]> {
  return mockMaterials;
}

export async function getMaterial(id: string): Promise<Material | null> {
  return mockMaterials.find((m) => m.id === id) ?? null;
}

export async function getDocumentChats(): Promise<DocumentChatSummary[]> {
  return mockDocumentChats;
}

/** Page currently shown in the file viewer for a material. */
export async function getMaterialPage(materialId: string): Promise<MaterialPage | null> {
  return mockMaterialPages.find((p) => p.materialId === materialId) ?? null;
}

/** The document chat about a material, or null if none started yet. */
export async function getDocumentThread(materialId: string): Promise<DocumentThread | null> {
  return mockDocumentThreads.find((t) => t.materialId === materialId) ?? null;
}
