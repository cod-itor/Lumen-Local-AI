import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Sign up — Lumen" };

export default function SignupPage() {
  return (
    <AuthCard
      icon={<GraduationCap />}
      title="Create your account"
      description="Free for students. Your study partner, private by design."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
