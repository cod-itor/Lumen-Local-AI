import "server-only";
import { mockImageGallery, mockImageSidebar, mockImageThread } from "@/mocks/images";
import type { GeneratedImage, ImageGallery, ImageSidebarData, ImageThread } from "@/types/images";

// Swap each body for `apiFetch(...)` (see ./api.ts) when the backend is ready.

export async function getImageSidebar(): Promise<ImageSidebarData> {
  return mockImageSidebar;
}

/** The active image conversation (06 · Prompt approval). */
export async function getImageThread(): Promise<ImageThread> {
  return mockImageThread;
}

/** All generated images, grouped by day (07 · Generated images). */
export async function getImageGallery(): Promise<ImageGallery> {
  return mockImageGallery;
}

export async function getGeneratedImage(id: string): Promise<GeneratedImage | null> {
  for (const group of mockImageGallery.groups) {
    const found = group.images.find((i) => i.id === id);
    if (found) return found;
  }
  return null;
}

export async function getGeneratedImageIds(): Promise<string[]> {
  return mockImageGallery.groups.flatMap((g) => g.images.map((i) => i.id));
}
