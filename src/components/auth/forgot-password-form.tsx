"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useMessages } from "@/i18n/provider";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { AuthFieldError, IconInput, SubmitButton } from "./fields";
import { applyFieldErrors } from "./form-utils";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { flow, setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();
  const m = useMessages();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: flow.email ?? "" },
    mode: "onTouched",
  });

  const onSubmit = (values: ForgotPasswordInput) => {
    setMessage(null);
    startTransition(async () => {
      const res = await forgotPasswordAction(values);
      if (!res.ok) {
        applyFieldErrors(form, res);
        setMessage(res.message ?? null);
        shake();
        return;
      }
      setDone(true);
      setFlow({ email: values.email, purpose: "reset", resetToken: null });
      router.push("/verify");
    });
  };

  return (
    <motion.form animate={controls} noValidate onSubmit={form.handleSubmit(onSubmit, shake)}>
      <FieldGroup className="gap-4 short:gap-3">
        <FormAlert message={message} />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="forgot-email">{m.auth.fields.email}</FieldLabel>
              <IconInput
                {...field}
                icon={Mail}
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={m.auth.fields.emailPlaceholder}
                autoFocus
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription className="text-[13px]">
                {m.auth.forgot.hint}
              </FieldDescription>
              <AuthFieldError error={fieldState.error} />
            </Field>
          )}
        />
        <SubmitButton pending={pending} done={done} pendingLabel={m.auth.forgot.pending}>
          {m.auth.forgot.submit}
        </SubmitButton>
      </FieldGroup>
    </motion.form>
  );
}
