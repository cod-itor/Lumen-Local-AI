import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyholeOpen } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { T } from "@/i18n/provider";

export const metadata: Metadata = { title: "Forgot password — Lumen" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      icon={<LockKeyholeOpen />}
      title={<T k="auth.forgot.title" />}
      description={<T k="auth.forgot.description" />}
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
          <ArrowLeft className="size-4" /> <T k="auth.backToLogin" />
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
