"use client";

import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { AlertCircle } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EASE } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/** Frosted card that frames every auth step — same glass as the landing page. */
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
    <Card
      className={cn(
        "glass gap-7 rounded-3xl bg-transparent px-5 py-8 text-foreground ring-0 has-data-[slot=card-footer]:pb-8 sm:px-9 sm:py-10 sm:has-data-[slot=card-footer]:pb-10",
        className,
      )}
    >
      <CardHeader className="justify-items-center gap-2 px-0 text-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.05 }}
          className="bg-primary-fill mb-2 flex size-12 items-center justify-center rounded-2xl [&_svg]:size-5 [&_svg]:stroke-[1.8]"
        >
          {icon}
        </motion.span>
        <CardTitle className="text-[26px] leading-[32px] font-semibold tracking-[-0.6px] sm:text-[28px]">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="max-w-[340px] text-[15px] leading-[22px] text-balance">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-0">{children}</CardContent>
      {footer && (
        <CardFooter className="justify-center rounded-none border-0 bg-transparent px-0 py-0 text-center text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      )}
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

/** Form-level error (e.g. wrong password) shown above the fields. */
export function FormAlert({ message }: { message: string | null }) {
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
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
