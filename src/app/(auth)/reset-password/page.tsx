import type { Metadata } from "next";
import { ResetPasswordStep } from "@/components/auth/reset-password-step";

export const metadata: Metadata = { title: "Reset password — Lumen" };

export default function ResetPasswordPage() {
  return <ResetPasswordStep />;
}
