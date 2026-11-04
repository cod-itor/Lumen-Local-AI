"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import { AuthCard, FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { PasswordInput, PasswordStrength, SubmitButton } from "./fields";
import { applyFieldErrors, fieldErrorClass } from "./form-utils";
import { StepSwap } from "./step-swap";
import { SuccessCard, SuccessState } from "./success-state";

export function ResetPasswordStep() {
  const { flow, setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const password = useWatch({ control: form.control, name: "password" });

  const onSubmit = (values: ResetPasswordInput) => {
    setMessage(null);
    startTransition(async () => {
      const res = await resetPasswordAction(values, flow.resetToken);
      if (!res.ok) {
        applyFieldErrors(form, res);
        setMessage(res.message ?? null);
        shake();
        return;
      }
      setFlow({ resetToken: null });
      setDone(true);
    });
  };

  if (done) {
    return (
      <StepSwap stepKey="done">
        <SuccessCard>
          <SuccessState
            title="Password updated"
            description="Your new password is set. Use it the next time you log in."
          >
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary-fill h-11 w-full rounded-full text-[15px] hover:-translate-y-px",
              )}
            >
              Back to log in
            </Link>
          </SuccessState>
        </SuccessCard>
      </StepSwap>
    );
  }

  return (
    <StepSwap stepKey="form">
      <AuthCard
        icon={<KeyRound />}
        title="Set a new password"
        description={
          flow.email ? (
            <>
              For <span className="font-medium break-all text-foreground">{flow.email}</span>. Make it strong and
              unique.
            </>
          ) : (
            "Make it strong and unique — at least 8 characters."
          )
        }
        footer={
          <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
            <ArrowLeft className="size-4" /> Back to log in
          </Link>
        }
      >
        <motion.form animate={controls} noValidate onSubmit={form.handleSubmit(onSubmit, shake)}>
          <FieldGroup className="gap-5">
            <FormAlert message={message} />
            <Controller
              name="password"
              control={form.control}
              rules={{ deps: ["confirmPassword"] }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="reset-password">New password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id="reset-password"
                    autoComplete="new-password"
                    placeholder="Create a new password"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                    aria-describedby="reset-password-strength"
                  />
                  <PasswordStrength id="reset-password-strength" value={password} />
                  <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="reset-confirm">Confirm new password</FieldLabel>
                  <PasswordInput
                    {...field}
                    id="reset-confirm"
                    autoComplete="new-password"
                    placeholder="Repeat it"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
                </Field>
              )}
            />
            <SubmitButton pending={pending} pendingLabel="Updating…">
              Update password
            </SubmitButton>
          </FieldGroup>
        </motion.form>
      </AuthCard>
    </StepSwap>
  );
}
