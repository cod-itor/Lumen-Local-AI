import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyholeOpen } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password — Lumen" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      icon={<LockKeyholeOpen />}
      title="Forgot your password?"
      description="No worries. Enter the email you signed up with and we’ll send you a code."
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
          <ArrowLeft className="size-4" /> Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
