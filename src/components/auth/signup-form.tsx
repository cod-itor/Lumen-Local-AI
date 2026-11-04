"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { signupAction } from "@/app/(auth)/actions";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { IconInput, PasswordInput, PasswordStrength, SubmitButton } from "./fields";
import { applyFieldErrors, fieldErrorClass } from "./form-utils";

export function SignupForm() {
  const router = useRouter();
  const { setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();

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
        <FieldGroup className="gap-5">
          <FormAlert message={message} />

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-name">Name</FieldLabel>
                <IconInput
                  {...field}
                  icon={UserRound}
                  id="signup-name"
                  autoComplete="name"
                  placeholder="Sokha Kim"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <IconInput
                  {...field}
                  icon={Mail}
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            rules={{ deps: ["confirmPassword"] }}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <PasswordInput
                  {...field}
                  id="signup-password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby="signup-password-strength"
                />
                <PasswordStrength id="signup-password-strength" value={password} />
                <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="signup-confirm">Confirm password</FieldLabel>
                <PasswordInput
                  {...field}
                  id="signup-confirm"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
              </Field>
            )}
          />


          <SubmitButton pending={pending} done={done} pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </FieldGroup>
      </motion.form>
    </div>
  );
}
