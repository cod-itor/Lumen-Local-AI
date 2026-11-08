"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { EASE } from "@/components/landing/motion";
import { useTranslate } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Content of one auth step: badge, title, form, footer. The glass card frame
 * itself is <AuthFrame> in the (auth) layout, so it never moves or resizes
 * between steps — only this content cross-fades inside it.
 */
export function AuthCard({
  icon,
  title,
  description,
  children,
  footer,
  className,
}: {
  /** A rendered icon element, e.g. <Sparkles /> (sized by the badge). */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 short:gap-4", className)}>
      <header className="flex flex-col items-center gap-1.5 text-center">
        <span className="bg-primary-fill mb-2 flex size-11 short:hidden items-center justify-center rounded-2xl [&_svg]:size-5 [&_svg]:stroke-[1.8]">
          {icon}
        </span>
        <h1 className="text-[25px] leading-[31px] font-semibold tracking-[-0.6px] sm:text-[27px]">{title}</h1>
        {description && (
          <p className="max-w-[340px] text-[14.5px] leading-[21px] text-balance text-muted-foreground">{description}</p>
        )}
      </header>
      <div>{children}</div>
      {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

/**
 * The fixed glass card for every auth step. Its height comes from the
 * viewport, not the content, so switching steps never shifts the layout; a
 * step taller than the space scrolls inside the card, not the page.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <Card className="glass min-h-0 flex-1 gap-0 rounded-3xl bg-transparent py-0 text-foreground ring-0 lg:max-h-[760px]">
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 [scrollbar-width:thin] sm:px-9">
        <div className="my-auto py-7 sm:py-8 short:py-5">{children}</div>
      </CardContent>
    </Card>
  );
}

/** Horizontal shake for a rejected form. Transform-only, skipped with reduced motion. */
export function useShake() {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  const shake = useCallback(() => {
    if (reduce) return;
    void controls.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.42, ease: "easeInOut" } });
  }, [controls, reduce]);
  return { controls, shake };
}

/** Form-level error (e.g. wrong password) shown above the fields. `message` is an i18n key. */
export function FormAlert({ message }: { message: string | null }) {
  const t = useTranslate();
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <Alert variant="destructive" className="rounded-xl border-destructive/30 bg-destructive/10">
            <AlertCircle />
            <AlertDescription>{t(message)}</AlertDescription>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
