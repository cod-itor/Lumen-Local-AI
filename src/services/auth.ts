import "server-only";
import { mockAuthBrand, mockAuthRules } from "@/mocks/auth";
import type { ForgotPasswordInput, LoginInput, ResetPasswordInput, SignupInput, VerifyOtpInput } from "@/lib/validation/auth";
import type { AuthBrandContent, AuthResult, OtpPurpose } from "@/types/auth";

/**
 * Auth service — mock implementation. Inputs arrive already validated by the
 * server actions. When the backend is ready, swap each body for
 * `apiFetch(...)` (./api.ts) and set the session cookie in the action.
 */

const wait = (ms = mockAuthRules.latencyMs) => new Promise((r) => setTimeout(r, ms));

export async function getAuthBrandContent(): Promise<AuthBrandContent> {
  return mockAuthBrand;
}

export async function signIn(input: LoginInput): Promise<AuthResult> {
  await wait();
  if (input.password === mockAuthRules.wrongPassword) {
    return { ok: false, message: "Incorrect email or password. Try again or reset your password." };
  }
  return { ok: true };
}

export async function signUp(input: SignupInput): Promise<AuthResult> {
  await wait();
  if (input.email.toLowerCase() === mockAuthRules.takenEmail) {
    return { ok: false, fieldErrors: { email: "An account with this email already exists" } };
  }
  return { ok: true };
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<AuthResult> {
  void input;
  await wait();
  // Always succeed, so the form never reveals which emails have accounts.
  return { ok: true };
}

export async function verifyOtp(input: VerifyOtpInput, purpose: OtpPurpose): Promise<AuthResult<{ resetToken?: string }>> {
  await wait();
  if (input.code === mockAuthRules.invalidCode) {
    return { ok: false, fieldErrors: { code: "That code is invalid or has expired" } };
  }
  return { ok: true, data: purpose === "reset" ? { resetToken: crypto.randomUUID() } : undefined };
}

export async function resendOtp(): Promise<AuthResult<{ cooldownSec: number }>> {
  await wait(500);
  return { ok: true, data: { cooldownSec: mockAuthRules.resendCooldownSec } };
}

export async function resetPassword(input: ResetPasswordInput, token: string | null): Promise<AuthResult> {
  void input;
  void token;
  await wait();
  return { ok: true };
}

export function getResendCooldownSec() {
  return mockAuthRules.resendCooldownSec;
}
