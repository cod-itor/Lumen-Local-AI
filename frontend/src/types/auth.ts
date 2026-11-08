/** What a one-time code is for: confirming a new account or resetting a password. */
export type OtpPurpose = "signup" | "reset";

/**
 * Result of every auth call. Field errors are keyed by form field name.
 * `message` and field error values are i18n keys (e.g. "auth.errors.emailTaken").
 */
export type AuthResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> };

/** Copy for the brand panel beside the auth forms. */
export type AuthBrandContent = {
  badge: string;
  headline: string;
  phrases: string[];
  subtitle: string;
  preview: { question: string; answer: string; model: string };
  points: { icon: string; title: string; body: string }[];
};
