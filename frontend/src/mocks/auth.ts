import type { Localized } from "@/i18n/config";
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

/** Brand panel copy beside the auth forms, in every language. */
export const mockAuthBrand: Localized<AuthBrandContent> = {
  en: {
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
  },
  km: {
    badge: "ដំណើរការ ១០០% លើឧបករណ៍របស់អ្នក",
    headline: "រៀនអ្វីក៏បាន",
    phrases: ["ជាភាសាខ្មែរ។", "ជាភាសាអង់គ្លេស។", "ដោយគ្មានអ៊ីនធឺណិត។", "ដោយឯកជន។"],
    subtitle:
      "ដៃគូរៀន AI ឯកជនរបស់អ្នក។ ជជែកជាមួយប្រភព សួរឯកសាររបស់អ្នកផ្ទាល់ ហើយរៀនមួយជំហានម្ដងៗ — គ្មានអ្វីចេញពីកុំព្យូទ័ររបស់អ្នកទេ។",
    preview: {
      question: "ពន្យល់ពីរស្មីសំយោគឱ្យងាយយល់",
      answer:
        "រុក្ខជាតិចាប់យកពន្លឺព្រះអាទិត្យដោយក្លរ៉ូភីល ហើយប្រើវាដើម្បីបំប្លែងទឹក និងកាបូនឌីអុកស៊ីតទៅជាស្ករ — ព្រមទាំងបញ្ចេញអុកស៊ីសែនផងដែរ។",
      model: "Gemma 4 E2B · ក្នុងម៉ាស៊ីន",
    },
    points: [
      { icon: "landing-lock", title: "ឯកជនតាំងពីដើម", body: "កំណត់ចំណាំ និងការជជែករបស់អ្នក មិនដែលចេញពីឧបករណ៍នេះទេ។" },
      { icon: "landing-lang", title: "ខ្មែរ និងអង់គ្លេស", body: "សួរ និងឆ្លើយជាភាសាដែលអ្នកគិត។" },
      { icon: "landing-cpu", title: "ប្រើបានគ្មានអ៊ីនធឺណិត", body: "មិនត្រូវការអ៊ីនធឺណិតទេ ពេលទាញយកម៉ូដែលរួច។" },
    ],
  },
};
