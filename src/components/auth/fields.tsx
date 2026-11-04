"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Eye, EyeOff, LockKeyhole, type LucideIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { passwordScore, PASSWORD_RULES } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

const groupClass = "h-11 rounded-xl bg-background/40 dark:bg-input/30";

/** shadcn InputGroup with a leading icon. */
export function IconInput({ icon: IconCmp, className, ...props }: ComponentProps<"input"> & { icon: LucideIcon }) {
  return (
    <InputGroup className={cn(groupClass, className)}>
      <InputGroupAddon>
        <IconCmp strokeWidth={1.8} />
      </InputGroupAddon>
      <InputGroupInput {...props} className="text-[15px] md:text-[15px]" />
    </InputGroup>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup className={cn(groupClass, className)}>
      <InputGroupAddon>
        <LockKeyhole strokeWidth={1.8} />
      </InputGroupAddon>
      <InputGroupInput {...props} type={visible ? "text" : "password"} className="text-[15px] md:text-[15px]" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="rounded-full"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={visible ? "hide" : "show"}
              initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
              transition={{ duration: 0.16 }}
              className="flex"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </motion.span>
          </AnimatePresence>
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

const LEVELS = [
  { label: "Too short", bar: "bg-muted-foreground/40" },
  { label: "Weak", bar: "bg-danger" },
  { label: "Fair", bar: "bg-brand-orange" },
  { label: "Good", bar: "bg-brand-blue" },
  { label: "Strong", bar: "bg-success" },
] as const;

/** Four-bar strength meter + rule checklist. Fixed height, so nothing jumps. */
export function PasswordStrength({ value, id }: { value: string; id?: string }) {
  const score = passwordScore(value);
  const level = LEVELS[score];
  return (
    <div id={id} className="flex flex-col gap-2.5" aria-live="polite">
      <div className="flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <motion.span
              className={cn("block h-full origin-left rounded-full transition-colors duration-300", level.bar)}
              initial={false}
              animate={{ scaleX: i < score ? 1 : 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 }}
            />
          </span>
        ))}
      </div>
      <div className="flex items-start justify-between gap-3">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return (
              <li
                key={rule.id}
                className={cn(
                  "flex items-center gap-1.5 text-[12.5px] transition-colors duration-200",
                  ok ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-full transition-colors duration-200",
                    ok ? "bg-success text-background" : "bg-foreground/10 text-transparent",
                  )}
                >
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
                {rule.label}
                <span className="sr-only">{ok ? "(done)" : "(missing)"}</span>
              </li>
            );
          })}
        </ul>
        <span className="shrink-0 text-[12.5px] font-medium text-muted-foreground">
          {value ? level.label : ""}
        </span>
      </div>
    </div>
  );
}

/** Full-width primary submit with pending + done states. */
export function SubmitButton({
  pending,
  done,
  pendingLabel,
  children,
  className,
  ...props
}: ComponentProps<typeof Button> & { pending?: boolean; done?: boolean; pendingLabel: string }) {
  const state = done ? "done" : pending ? "pending" : "idle";
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending || done}
      aria-busy={pending}
      className={cn(
        "bg-primary-fill h-11 w-full overflow-hidden rounded-full text-[15px] hover:-translate-y-px hover:bg-primary disabled:opacity-100",
        className,
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-2"
        >
          {state === "pending" && <Spinner />}
          {state === "done" && <Check className="size-4" strokeWidth={2.5} />}
          {state === "pending" ? pendingLabel : state === "done" ? "Done" : children}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

/** "or" divider between social sign-in and the email form. */
export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[12.5px] text-muted-foreground">
      <Separator className="flex-1 data-horizontal:w-auto" />
      {children}
      <Separator className="flex-1 data-horizontal:w-auto" />
    </div>
  );
}
