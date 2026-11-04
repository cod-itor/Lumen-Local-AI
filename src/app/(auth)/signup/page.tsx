import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { T } from "@/i18n/provider";

export const metadata: Metadata = { title: "Sign up — Lumen" };

export default function SignupPage() {
  return (
    <AuthCard
      icon={<GraduationCap />}
      title={<T k="auth.signup.title" />}
      description={<T k="auth.signup.description" />}
      footer={
        <span>
          <T k="auth.signup.haveAccount" />{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            <T k="auth.signup.logIn" />
          </Link>
        </span>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
