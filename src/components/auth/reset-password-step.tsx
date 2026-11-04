"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { resetPasswordAction } from "@/app/(auth)/actions";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useMessages } from "@/i18n/provider";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import { AuthCard, FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { AuthFieldError, PasswordInput, PasswordStrength, SubmitButton } from "./fields";
import { applyFieldErrors } from "./form-utils";
import { StepSwap } from "./step-swap";
import { SuccessCard, SuccessState } from "./success-state";

export function ResetPasswordStep() {
  const { flow, setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();
  const m = useMessages();

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
            title={m.auth.reset.doneTitle}
            description={m.auth.reset.doneBody}
          >
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary-fill h-11 w-full rounded-full text-[15px] hover:-translate-y-px",
              )}
            >
              {m.auth.backToLogin}
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
        title={m.auth.reset.title}
        description={
          flow.email ? (
            <WithEmail template={m.auth.reset.forEmail} email={flow.email} />
          ) : (
            m.auth.reset.description
          )
        }
        footer={
          <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
            <ArrowLeft className="size-4" /> {m.auth.backToLogin}
          </Link>
        }
      >
        <motion.form animate={controls} noValidate onSubmit={form.handleSubmit(onSubmit, shake)}>
          <FieldGroup className="gap-4 short:gap-3">
            <FormAlert message={message} />
            <Controller
              name="password"
              control={form.control}
              rules={{ deps: ["confirmPassword"] }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="reset-password">{m.auth.reset.password}</FieldLabel>
                  <PasswordInput
                    {...field}
                    id="reset-password"
                    autoComplete="new-password"
                    placeholder={m.auth.reset.passwordPlaceholder}
                    autoFocus
                    aria-invalid={fieldState.invalid}
                    aria-describedby="reset-password-strength"
                  />
                  <PasswordStrength id="reset-password-strength" value={password} />
                  <AuthFieldError error={fieldState.error} />
                </Field>
              )}
            />
            <Controller
              name="confirmPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="reset-confirm">{m.auth.reset.confirm}</FieldLabel>
                  <PasswordInput
                    {...field}
                    id="reset-confirm"
                    autoComplete="new-password"
                    placeholder={m.auth.reset.confirmPlaceholder}
                    aria-invalid={fieldState.invalid}
                  />
                  <AuthFieldError error={fieldState.error} />
                </Field>
              )}
            />
            <SubmitButton pending={pending} pendingLabel={m.auth.reset.pending}>
              {m.auth.reset.submit}
            </SubmitButton>
          </FieldGroup>
        </motion.form>
      </AuthCard>
    </StepSwap>
  );
}

/** Renders a "…{email}…" message with the email emphasised. */
function WithEmail({ template, email }: { template: string; email: string }) {
  const [before, after = ""] = template.split("{email}");
  return (
    <>
      {before}
      <span className="font-medium break-all text-foreground">{email}</span>
      {after}
    </>
  );
}
