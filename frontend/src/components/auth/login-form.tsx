"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useMessages } from "@/i18n/provider";
import { nextPath, signIn } from "@/lib/auth-client";
import { demoLoginSchema, loginSchema, type LoginInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { AuthFieldError, IconInput, PasswordInput, SubmitButton } from "./fields";
import { applyFieldErrors } from "./form-utils";

// Same as DEMO_ACCOUNT in lib/demo/mode.ts. Only used inside the demo-only branch below, so the real build drops them.
const DEMO_USER = "test";
const DEMO_PASSWORD = "123";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();
  const m = useMessages();

  const form = useForm<LoginInput>({
    // Inline env check so the real build keeps the strict email rule.
    resolver: zodResolver(process.env.NEXT_PUBLIC_LUMEN_DEMO === "1" ? demoLoginSchema : loginSchema),
    defaultValues: { email: "", password: "", remember: true },
    mode: "onTouched",
  });

  const onSubmit = (values: LoginInput) => {
    setMessage(null);
    startTransition(async () => {
      const res = await signIn(values.email.trim(), values.password);
      if (!res.ok) {
        applyFieldErrors(form, res);
        setMessage(res.message ?? null);
        shake();
        return;
      }
      setDone(true);
      router.push(nextPath());
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.form animate={controls} noValidate onSubmit={form.handleSubmit(onSubmit, shake)}>
        <FieldGroup className="gap-4 short:gap-3">
          <FormAlert message={message} />

          {process.env.NEXT_PUBLIC_LUMEN_DEMO === "1" && (
            <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border px-3 py-2 text-[13px]">
              <span className="min-w-0 text-muted-foreground">
                <span className="font-medium text-foreground">{m.common.demo.account}</span> · {m.common.demo.username}{" "}
                <span className="font-medium text-foreground">{DEMO_USER}</span> · {m.common.demo.password}{" "}
                <span className="font-medium text-foreground">{DEMO_PASSWORD}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  form.setValue("email", DEMO_USER, { shouldValidate: true });
                  form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
                className="shrink-0 rounded-[10px] border border-border px-3 py-1 font-medium text-foreground hover:bg-accent"
              >
                {m.common.demo.useAccount}
              </button>
            </div>
          )}

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="login-email">{m.auth.fields.email}</FieldLabel>
                <IconInput
                  {...field}
                  icon={Mail}
                  id="login-email"
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
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="login-password">{m.auth.fields.password}</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {m.auth.login.forgot}
                  </Link>
                </div>
                <PasswordInput
                  {...field}
                  id="login-password"
                  autoComplete="current-password"
                  placeholder={m.auth.login.passwordPlaceholder}
                  aria-invalid={fieldState.invalid}
                />
                <AuthFieldError error={fieldState.error} />
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
                  {m.auth.login.remember}
                </FieldLabel>
              </Field>
            )}
          />

          <SubmitButton pending={pending} done={done} pendingLabel={m.auth.login.pending}>
            {m.auth.login.submit}
          </SubmitButton>
        </FieldGroup>
      </motion.form>
    </div>
  );
}
