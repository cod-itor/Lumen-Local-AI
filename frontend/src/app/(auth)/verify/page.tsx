import type { Metadata } from "next";
import { VerifyStep } from "@/components/auth/verify-step";

export const metadata: Metadata = { title: "Verify your email — Lumen" };

export default function VerifyPage() {
  return <VerifyStep />;
}
