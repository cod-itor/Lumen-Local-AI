"use server";

import { z } from "zod";
import {
  fieldErrorsOf,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from "@/lib/validation/auth";
import * as auth from "@/services/auth";
import type { AuthResult, OtpPurpose, SocialProvider } from "@/types/auth";

/*
  Server actions for the auth forms. Every input is re-validated here with the
  same schemas the forms use — client validation is only for UX.
*/

function invalid(error: z.ZodError): AuthResult<never> {
  return { ok: false, fieldErrors: fieldErrorsOf(error) };
}

export async function loginAction(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  return parsed.success ? auth.signIn(parsed.data) : invalid(parsed.error);
}

const providerSchema = z.enum(["google", "apple"]);

export async function socialLoginAction(provider: SocialProvider) {
  const parsed = providerSchema.safeParse(provider);
  return parsed.success ? auth.signInWithProvider(parsed.data) : invalid(parsed.error);
}

export async function signupAction(input: unknown) {
  const parsed = signupSchema.safeParse(input);
  return parsed.success ? auth.signUp(parsed.data) : invalid(parsed.error);
}

export async function forgotPasswordAction(input: unknown) {
  const parsed = forgotPasswordSchema.safeParse(input);
  return parsed.success ? auth.requestPasswordReset(parsed.data) : invalid(parsed.error);
}

const purposeSchema = z.enum(["signup", "reset"]);

export async function verifyOtpAction(input: unknown, purpose: OtpPurpose) {
  const parsed = verifyOtpSchema.safeParse(input);
  const kind = purposeSchema.safeParse(purpose);
  if (!kind.success) return invalid(kind.error);
  return parsed.success ? auth.verifyOtp(parsed.data, kind.data) : invalid(parsed.error);
}

export async function resendOtpAction() {
  return auth.resendOtp();
}

export async function resetPasswordAction(input: unknown, token: string | null) {
  const parsed = resetPasswordSchema.safeParse(input);
  const safeToken = typeof token === "string" && token.length <= 64 ? token : null;
  return parsed.success ? auth.resetPassword(parsed.data, safeToken) : invalid(parsed.error);
}
