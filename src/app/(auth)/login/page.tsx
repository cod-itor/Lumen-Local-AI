import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { T } from "@/i18n/provider";

export const metadata: Metadata = { title: "Log in — Lumen" };

export default function LoginPage() {
  return (
    <AuthCard
      icon={<Sparkles />}
      title={<T k="auth.login.title" />}
      description={<T k="auth.login.description" />}
      footer={
        <span>
          <T k="auth.login.newHere" />{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            <T k="auth.login.createAccount" />
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
