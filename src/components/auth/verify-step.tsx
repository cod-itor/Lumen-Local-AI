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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { verifyOtpSchema, type VerifyOtpInput } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import { AuthCard, FormAlert, useShake } from "./auth-card";
import { useAuthFlow } from "./auth-flow";
import { AuthFieldError, SubmitButton } from "./fields";
import { applyFieldErrors } from "./form-utils";
import { StepSwap } from "./step-swap";
import { SuccessCard, SuccessState } from "./success-state";

const slotClass =
  "size-11 rounded-xl border text-xl font-semibold first:rounded-xl first:border-l last:rounded-xl sm:size-12 bg-background/40 dark:bg-input/30";

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "Resend in {time}" with the countdown emphasised. */
function ResendIn({ template, seconds }: { template: string; seconds: number }) {
  const [before, after = ""] = template.split("{time}");
  return (
    <>
      {before}
      <span className="font-medium text-foreground tabular-nums">{formatSeconds(seconds)}</span>
      {after}
    </>
  );
}

export function VerifyStep() {
  const router = useRouter();
  const { flow, setFlow, resendCooldownSec } = useAuthFlow();
  const [pending, startTransition] = useTransition();
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { controls, shake } = useShake();
  const m = useMessages();

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
            title={firstName ? format(m.auth.verify.welcomeName, { name: firstName }) : m.auth.verify.welcome}
            description={m.auth.verify.welcomeBody}
          >
            <Link
              href="/chat"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary-fill h-11 w-full rounded-full text-[15px] hover:-translate-y-px",
              )}
            >
              {m.auth.verify.start}
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
        title={m.auth.verify.title}
        description={
          <>
            {m.auth.verify.sentTo}{" "}
            <span className="font-medium break-all text-foreground">{flow.email ?? m.auth.verify.yourEmail}</span>
          </>
        }
        footer={
          <span>
            {m.auth.verify.wrongEmail}{" "}
            <Link
              href={flow.purpose === "reset" ? "/forgot-password" : "/signup"}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {m.auth.verify.changeIt}
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
                    {m.auth.verify.codeLabel}
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
                  <AuthFieldError className="text-center" error={fieldState.error} />
                </Field>
              )}
            />

            <SubmitButton pending={pending} pendingLabel={m.auth.verify.pending}>
              {m.auth.verify.submit}
            </SubmitButton>

            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground" aria-live="polite">
              {left > 0 ? (
                <span>
                  {resent ? m.auth.verify.newCodeSent : m.auth.verify.didntGetIt}{" "}
                  <ResendIn template={m.auth.verify.resendIn} seconds={left} />
                </span>
              ) : (
                <>
                  <span>{m.auth.verify.didntGetIt}</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={resend}
                    disabled={resending}
                    className="h-auto px-1 text-foreground"
                  >
                    {resending && <Spinner />}
                    {m.auth.verify.resend}
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
