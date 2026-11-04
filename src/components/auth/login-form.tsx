"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { loginAction } from "@/app/(auth)/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { IconInput, PasswordInput, SubmitButton } from "./fields";
import { applyFieldErrors, fieldErrorClass } from "./form-utils";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  });

  const onSubmit = (values: LoginInput) => {
    setMessage(null);
    startTransition(async () => {
      const res = await loginAction(values);
      if (!res.ok) {
        applyFieldErrors(form, res);
        setMessage(res.message ?? null);
        shake();
        return;
      }
      setDone(true);
      router.push("/chat");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.form animate={controls} noValidate onSubmit={form.handleSubmit(onSubmit, shake)}>
        <FieldGroup className="gap-4 short:gap-3">
          <FormAlert message={message} />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <IconInput
                  {...field}
                  icon={Mail}
                  id="login-email"
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
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  {...field}
                  id="login-password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="remember"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="login-remember"
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                <FieldLabel htmlFor="login-remember" className="font-normal text-muted-foreground">
                  Keep me signed in
                </FieldLabel>
              </Field>
            )}
          />

          <SubmitButton pending={pending} done={done} pendingLabel="Signing in…">
            Log in
          </SubmitButton>
        </FieldGroup>
      </motion.form>
    </div>
  );
}
