import type { Localized } from "@/i18n/config";

/**
 * Image workspace types (Figma "06 · Image · Prompt approval", "07 · Image ·
 * Generated images", "Left Sidebar · Image"). Mocks and services conform to these.
 */

export type GeneratedImage = {
  id: string;
  /** Public URL of the image (mock artwork lives in /public/images). */
  src: string;
  alt: string;
  /** Final prompt the image was generated from. */
  prompt: string;
};

export type ImageGroup = {
  id: string;
  label: Localized<string>; // "Today", "Yesterday", "Earlier"
  images: GeneratedImage[];
};

export type ImageGallery = {
  total: number;
  groups: ImageGroup[];
};

/** Sidebar "Recents" entry. */
export type ImageRecent = {
  id: string;
  title: string;
  href: string;
};

export type ImageSidebarData = {
  newImageHref: string;
  galleryHref: string;
  recents: ImageRecent[];
};

export type ImageThreadMessage =
  | { kind: "user"; id: string; text: string }
  | { kind: "images"; id: string; images: GeneratedImage[] }
  | {
      kind: "clarify";
      id: string;
      question: string;
      options: string[];
      selected: string;
    }
  | {
      kind: "approval";
      id: string;
      /** The model's rewritten prompt (the card title comes from the dictionary). */
      prompt: string;
      /** Where "Generate" leads once the images are ready. */
      resultHref: string;
    };

export type ImageThread = {
  id: string;
  title: string;
  messages: ImageThreadMessage[];
  aspectRatios: string[];
  defaultAspectRatio: string;
};
