"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { IconInput, SubmitButton } from "./fields";
import { applyFieldErrors, fieldErrorClass } from "./form-utils";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { flow, setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();

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
      <FieldGroup className="gap-5">
        <FormAlert message={message} />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
              <IconInput
                {...field}
                icon={Mail}
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription className="text-[13px]">
                We’ll email you a 6-digit code to reset your password.
              </FieldDescription>
              <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
            </Field>
          )}
        />
        <SubmitButton pending={pending} done={done} pendingLabel="Sending code…">
          Send code
        </SubmitButton>
      </FieldGroup>
    </motion.form>
  );
}
