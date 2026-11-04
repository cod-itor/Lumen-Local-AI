"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { motion } from "motion/react";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { resendOtpAction, verifyOtpAction } from "@/app/(auth)/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { verifyOtpSchema, type VerifyOtpInput } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import { AuthCard, FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { SubmitButton } from "./fields";
import { applyFieldErrors, fieldErrorClass } from "./form-utils";
import { StepSwap } from "./step-swap";
import { SuccessCard, SuccessState } from "./success-state";

const slotClass =
  "size-11 rounded-xl border text-xl font-semibold first:rounded-xl first:border-l last:rounded-xl sm:size-12 bg-background/40 dark:bg-input/30";

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function VerifyStep() {
  const router = useRouter();
  const { flow, setFlow, resendCooldownSec } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();

  const [left, setLeft] = useState(resendCooldownSec);
  const [resending, startResend] = useTransition();
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const form = useForm<VerifyOtpInput>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = (values: VerifyOtpInput) => {
    setMessage(null);
    startTransition(async () => {
      const res = await verifyOtpAction(values, flow.purpose);
      if (!res.ok) {
        form.setValue("code", "");
        applyFieldErrors(form, res);
        setMessage(res.message ?? null);
        shake();
        return;
      }
      if (flow.purpose === "reset") {
        setFlow({ resetToken: res.data?.resetToken ?? null });
        router.push("/reset-password");
      } else {
        setVerified(true);
      }
    });
  };
  const submit = form.handleSubmit(onSubmit, shake);

  const resend = () => {
    startResend(async () => {
      const res = await resendOtpAction();
      if (res.ok) {
        setLeft(res.data?.cooldownSec ?? resendCooldownSec);
        setResent(true);
        form.clearErrors();
        form.setValue("code", "");
      }
    });
  };

  const firstName = flow.name?.split(" ")[0];

  if (verified) {
    return (
      <StepSwap stepKey="done">
        <SuccessCard>
          <SuccessState
            title={firstName ? `Welcome, ${firstName}!` : "You’re all set!"}
            description="Your account is verified. Your private study partner is ready — everything stays on this device."
          >
            <Link
              href="/chat"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary-fill h-11 w-full rounded-full text-[15px] hover:-translate-y-px",
              )}
            >
              Start learning
            </Link>
          </SuccessState>
        </SuccessCard>
      </StepSwap>
    );
  }

  return (
    <StepSwap stepKey="form">
      <AuthCard
        icon={<MailCheck />}
        title="Check your email"
        description={
          <>
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium break-all text-foreground">{flow.email ?? "your email"}</span>
          </>
        }
        footer={
          <span>
            Wrong email?{" "}
            <Link
              href={flow.purpose === "reset" ? "/forgot-password" : "/signup"}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Change it
            </Link>
          </span>
        }
      >
        <motion.form animate={controls} noValidate onSubmit={submit}>
          <FieldGroup className="gap-6">
            <FormAlert message={message} />
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="items-center">
                  <FieldLabel htmlFor="otp-code" className="sr-only">
                    Verification code
                  </FieldLabel>
                  <InputOTP
                    id="otp-code"
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      if (fieldState.error) form.clearErrors("code");
                    }}
                    onBlur={field.onBlur}
                    onComplete={() => void submit()}
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS}
                    autoComplete="one-time-code"
                    autoFocus
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                    containerClassName="justify-center gap-2 sm:gap-3"
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2].map((i) => (
                        <InputOTPSlot key={i} index={i} aria-invalid={fieldState.invalid} className={slotClass} />
                      ))}
                    </InputOTPGroup>
                    <InputOTPSeparator className="text-muted-foreground" />
                    <InputOTPGroup className="gap-2">
                      {[3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} aria-invalid={fieldState.invalid} className={slotClass} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <FieldError className={cn(fieldErrorClass, "text-center")} errors={[fieldState.error]} />
                </Field>
              )}
            />

            <SubmitButton pending={pending} pendingLabel="Verifying…">
              Verify
            </SubmitButton>

            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground" aria-live="polite">
              {left > 0 ? (
                <span>
                  {resent ? "New code sent. " : "Didn’t get it? "}Resend in{" "}
                  <span className="font-medium text-foreground tabular-nums">{formatSeconds(left)}</span>
                </span>
              ) : (
                <>
                  <span>Didn’t get it?</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={resend}
                    disabled={resending}
                    className="h-auto px-1 text-foreground"
                  >
                    {resending && <Spinner />}
                    Resend code
                  </Button>
                </>
              )}
            </div>
          </FieldGroup>
        </motion.form>
      </AuthCard>
    </StepSwap>
  );
}
