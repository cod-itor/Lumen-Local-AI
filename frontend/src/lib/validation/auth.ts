import { z } from "zod";
import type { AuthMessages } from "@/i18n/messages/en/auth";

/**
 * Auth form schemas — shared by the client forms (instant feedback) and the
 * server actions (never trust the client), so the rules live in one place.
 * Messages and rule labels are i18n keys (src/i18n/messages/<lang>/auth.ts);
 * the UI translates them with useTranslate() before rendering.
 */

/** An auth error key, e.g. "auth.errors.emailRequired" (typo-checked). */
type ErrorKey = `auth.errors.${keyof AuthMessages["errors"]}`;
const e = (key: ErrorKey) => key;

type RuleKey = `auth.password.rules.${keyof AuthMessages["password"]["rules"]}`;

export const PASSWORD_RULES: readonly { id: string; label: RuleKey; test: (v: string) => boolean }[] = [
  { id: "length", label: "auth.password.rules.length", test: (v: string) => v.length >= 8 },
  { id: "case", label: "auth.password.rules.case", test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: "number", label: "auth.password.rules.number", test: (v: string) => /\d/.test(v) },
  { id: "symbol", label: "auth.password.rules.symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

/** 0–4: how many password rules pass. */
export function passwordScore(value: string) {
  return PASSWORD_RULES.filter((r) => r.test(value)).length;
}

const email = z
  .string()
  .trim()
  .min(1, e("auth.errors.emailRequired"))
  .max(254, e("auth.errors.emailTooLong"))
  .pipe(z.email(e("auth.errors.emailInvalid")));

/** The first three rules are required; a symbol only makes it stronger. */
const newPassword = z
  .string()
  .min(1, e("auth.errors.passwordCreate"))
  .max(72, e("auth.errors.passwordTooLong"))
  .refine(
    (v) => PASSWORD_RULES.slice(0, 3).every((r) => r.test(v)),
    e("auth.errors.passwordWeak"),
  );

const matchPasswords = <T extends { password: string; confirmPassword: string }>(d: T) =>
  d.password === d.confirmPassword;
const mismatch = { message: e("auth.errors.passwordMismatch"), path: ["confirmPassword"] };

export const loginSchema = z.object({
  email,
  password: z.string().min(1, e("auth.errors.passwordRequired")).max(72, e("auth.errors.passwordTooLong")),
  remember: z.boolean(),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, e("auth.errors.nameRequired")).max(60, e("auth.errors.nameTooLong")),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, e("auth.errors.confirmRequired")),
  })
  .refine(matchPasswords, mismatch);

export const forgotPasswordSchema = z.object({ email });

export const verifyOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, e("auth.errors.codeInvalidFormat")),
});

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, e("auth.errors.confirmRequired")),
  })
  .refine(matchPasswords, mismatch);

/** Demo build only: the login also accepts the short demo username ("test"), so the email check is relaxed. */
export const demoLoginSchema = loginSchema.extend({
  email: z.string().trim().min(1, e("auth.errors.emailRequired")).max(254, e("auth.errors.emailTooLong")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** First message per field, ready for react-hook-form's setError. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "root");
    out[key] ??= issue.message;
  }
  return out;
}
