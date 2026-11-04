import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in — Lumen" };

export default function LoginPage() {
  return (
    <AuthCard
      icon={<Sparkles />}
      title="Welcome back"
      description="Log in to pick up where you left off."
      footer={
        <span>
          New to Lumen?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
