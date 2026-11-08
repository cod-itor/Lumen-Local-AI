"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { signupAction } from "@/app/(auth)/actions";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useMessages } from "@/i18n/provider";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { AuthFieldError, IconInput, PasswordInput, PasswordStrength, SubmitButton } from "./fields";
import { applyFieldErrors } from "./form-utils";

export function SignupForm() {
  const router = useRouter();
  const { setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();
  const m = useMessages();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
    mode: "onTouched",
  });
  const password = useWatch({ control: form.control, name: "password" });

  const onSubmit = (values: SignupInput) => {
    setMessage(null);
    startTransition(async () => {
      const res = await signupAction(values);
      if (!res.ok) {
        applyFieldErrors(form, res);
        setMessage(res.message ?? null);
        shake();
        return;
      }
      setDone(true);
      setFlow({ email: values.email, name: values.name, purpose: "signup", resetToken: null });
      router.push("/verify");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.form animate={controls} noValidate onSubmit={form.handleSubmit(onSubmit, shake)}>
        <FieldGroup className="gap-4 short:gap-3">
          <FormAlert message={message} />

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-name">{m.auth.fields.name}</FieldLabel>
                <IconInput
                  {...field}
                  icon={UserRound}
                  id="signup-name"
                  autoComplete="name"
                  placeholder={m.auth.fields.namePlaceholder}
                  aria-invalid={fieldState.invalid}
                />
                <AuthFieldError error={fieldState.error} />
              </Field>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-email">{m.auth.fields.email}</FieldLabel>
                <IconInput
                  {...field}
                  icon={Mail}
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={m.auth.fields.emailPlaceholder}
                  aria-invalid={fieldState.invalid}
                />
                <AuthFieldError error={fieldState.error} />
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            rules={{ deps: ["confirmPassword"] }}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-password">{m.auth.fields.password}</FieldLabel>
                <PasswordInput
                  {...field}
                  id="signup-password"
                  autoComplete="new-password"
                  placeholder={m.auth.signup.passwordPlaceholder}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="signup-password-strength"
                />
                <PasswordStrength id="signup-password-strength" value={password} />
                <AuthFieldError error={fieldState.error} />
              </Field>
            )}
          />

          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-confirm">{m.auth.signup.confirm}</FieldLabel>
                <PasswordInput
                  {...field}
                  id="signup-confirm"
                  autoComplete="new-password"
                  placeholder={m.auth.signup.confirmPlaceholder}
                  aria-invalid={fieldState.invalid}
                />
                <AuthFieldError error={fieldState.error} />
              </Field>
            )}
          />

          <SubmitButton pending={pending} done={done} pendingLabel={m.auth.signup.pending}>
            {m.auth.signup.submit}
          </SubmitButton>
        </FieldGroup>
      </motion.form>
    </div>
  );
}
