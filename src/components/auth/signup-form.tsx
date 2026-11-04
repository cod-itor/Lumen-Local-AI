"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { signupAction } from "@/app/(auth)/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { IconInput, OrDivider, PasswordInput, PasswordStrength, SubmitButton } from "./fields";
import { applyFieldErrors, fieldErrorClass } from "./form-utils";
import { SocialButtons } from "./social-buttons";

export function SignupForm() {
  const router = useRouter();
  const { setFlow } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", terms: false },
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
      <SocialButtons disabled={pending || done} />
      <OrDivider>or sign up with email</OrDivider>

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

          <Controller
            name="terms"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                <Checkbox
                  id="signup-terms"
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
                <FieldContent>
                  <FieldLabel htmlFor="signup-terms" className="inline font-normal text-muted-foreground">
                    I agree to the{" "}
                    <Link href="/#privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/#privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
                      Privacy Policy
                    </Link>
                  </FieldLabel>
                  <FieldError className={fieldErrorClass} errors={[fieldState.error]} />
                </FieldContent>
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
