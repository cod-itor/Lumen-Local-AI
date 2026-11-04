import { z } from "zod";

/**
 * Auth form schemas — shared by the client forms (instant feedback) and the
 * server actions (never trust the client), so the rules live in one place.
 */

export const PASSWORD_RULES = [
  { id: "length", label: "8+ characters", test: (v: string) => v.length >= 8 },
  { id: "case", label: "Upper & lowercase", test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: "number", label: "A number", test: (v: string) => /\d/.test(v) },
  { id: "symbol", label: "A symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

/** 0–4: how many password rules pass. */
export function passwordScore(value: string) {
  return PASSWORD_RULES.filter((r) => r.test(value)).length;
}

const email = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .max(254, "That email is too long")
  .pipe(z.email("Enter a valid email address"));

/** The first three rules are required; a symbol only makes it stronger. */
const newPassword = z
  .string()
  .min(1, "Create a password")
  .max(128, "Use 128 characters or fewer")
  .refine(
    (v) => PASSWORD_RULES.slice(0, 3).every((r) => r.test(v)),
    "Use 8+ characters with upper & lowercase letters and a number",
  );

const matchPasswords = <T extends { password: string; confirmPassword: string }>(d: T) =>
  d.password === d.confirmPassword;
const mismatch = { message: "Passwords don’t match", path: ["confirmPassword"] };

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
  remember: z.boolean(),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(60, "Use 60 characters or fewer"),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine(matchPasswords, mismatch);

export const forgotPasswordSchema = z.object({ email });

export const verifyOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine(matchPasswords, mismatch);

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
