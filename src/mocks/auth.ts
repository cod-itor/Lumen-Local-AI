import type { AuthBrandContent } from "@/types/auth";

/**
 * Demo behaviour for the static auth UI (no backend yet). Any valid input
 * succeeds, except these values — handy for previewing the error states.
 */
export const mockAuthRules = {
  latencyMs: 700,
  /** Sign up with this email → "already registered". */
  takenEmail: "taken@lumen.app",
  /** Log in with this password → "incorrect email or password". */
  wrongPassword: "wrongpass",
  /** Enter this code → "code is invalid". */
  invalidCode: "000000",
  /** Seconds before "Resend code" unlocks. */
  resendCooldownSec: 30,
};

export const mockAuthBrand: AuthBrandContent = {
  badge: "Runs 100% on your device",
  headline: "Learn anything,",
  phrases: ["in Khmer.", "in English.", "fully offline.", "privately."],
  subtitle:
    "Your private AI study partner. Chat with sources, ask your own documents and learn step by step — nothing leaves your computer.",
  preview: {
    question: "Explain photosynthesis simply",
    answer:
      "Plants catch sunlight with chlorophyll and use it to turn water and carbon dioxide into sugar — releasing oxygen as a bonus.",
    model: "Gemma 4 E2B · local",
  },
  points: [
    { icon: "landing-lock", title: "Private by design", body: "Your notes and chats never leave this device." },
    { icon: "landing-lang", title: "Khmer & English", body: "Ask and answer in the language you think in." },
    { icon: "landing-cpu", title: "Works offline", body: "No internet needed once the model is downloaded." },
  ],
};
