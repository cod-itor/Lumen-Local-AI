import type {
  GeneratedImage,
  ImageGallery,
  ImageSidebarData,
  ImageThread,
} from "@/types/images";

const COFFEE_PROMPT =
  "Cozy coffee shop poster, warm morning light, hand-drawn illustration style";
const LOGO_PROMPT = "Logo for a study club called Bright Minds, star above an open book";
const ANGKOR_PROMPT = "Watercolor Angkor Wat at sunrise, soft pastel sky";

const img = (id: string, alt: string, prompt: string): GeneratedImage => ({
  id,
  src: `/images/img-${id}.svg`,
  alt,
  prompt,
});

const coffee = [
  img("coffee-1", "Coffee shop poster, warm illustration", COFFEE_PROMPT),
  img("coffee-2", "Coffee shop poster, light peach variant", COFFEE_PROMPT),
  img("coffee-3", "Coffee cup on a transparent background", `${COFFEE_PROMPT}, background removed`),
  img("coffee-4", "Coffee shop poster, soft peach variant", COFFEE_PROMPT),
];

const logos = [
  img("logo-1", "Bright Minds logo, blue", LOGO_PROMPT),
  img("logo-2", "Bright Minds logo, deep blue", LOGO_PROMPT),
  img("logo-3", "Bright Minds logo, light blue", LOGO_PROMPT),
  img("logo-4", "Bright Minds logo, pale blue", LOGO_PROMPT),
];

const angkor = [
  img("angkor-1", "Watercolor Angkor Wat, blue sky", ANGKOR_PROMPT),
  img("angkor-2", "Watercolor Angkor Wat, orange sky", ANGKOR_PROMPT),
  img("angkor-3", "Watercolor Angkor Wat, pale blue sky", ANGKOR_PROMPT),
  img("angkor-4", "Watercolor Angkor Wat, warm sky", ANGKOR_PROMPT),
];

export const mockImageGallery: ImageGallery = {
  total: 12,
  groups: [
    { id: "today", label: "Today", images: coffee },
    { id: "yesterday", label: "Yesterday", images: logos },
    { id: "earlier", label: "Earlier", images: angkor },
  ],
};

export const mockImageSidebar: ImageSidebarData = {
  newImageHref: "/image",
  galleryHref: "/image/coffee-1",
  recents: [
    { id: "coffee-shop-poster", title: "Coffee shop poster", href: "/image" },
    { id: "study-club-logo", title: "Logo for study club", href: "/image/logo-1" },
    { id: "watercolor-angkor", title: "Watercolor Angkor Wat", href: "/image/angkor-1" },
    { id: "product-photo", title: "Product photo, white background", href: "/image/coffee-3" },
    { id: "slide-background", title: "Slide background, soft blue", href: "/image/angkor-3" },
  ],
};

export const mockImageThread: ImageThread = {
  id: "coffee-shop-poster",
  title: "Coffee shop poster",
  messages: [
    { kind: "user", id: "m1", text: "Logo for a study club called Bright Minds" },
    { kind: "images", id: "m2", images: logos },
    { kind: "user", id: "m3", text: "Poster for a coffee shop" },
    {
      kind: "clarify",
      id: "m4",
      question: "Which style do you want?",
      options: ["Photo", "Illustration", "3D"],
      selected: "Illustration",
    },
    {
      kind: "approval",
      id: "m5",
      title: "Improved prompt",
      prompt:
        "Cozy coffee shop poster, warm morning light, hand-drawn illustration style, steaming cup on a wooden counter",
      resultHref: "/image/coffee-1",
    },
  ],
  composerPlaceholder: "Describe the image you want",
  disclaimer: "Prompts are shown for your approval before anything is generated.",
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  defaultAspectRatio: "1:1",
};
