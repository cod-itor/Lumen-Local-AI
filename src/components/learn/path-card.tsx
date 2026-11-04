"use client";

import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { LearningPath } from "@/types/learn";

const EASE = [0.22, 1, 0.36, 1] as const;

export type StepState = "done" | "current" | "locked";

/** Figma "Path Card": path title, progress bar, step list ("List/Check Item"). */
export function PathCard({
  path,
  currentStepIndex,
  viewStepIndex,
  onOpenStep,
  className,
}: {
  path: LearningPath;
  /** First unfinished step; equals steps.length when the path is complete. */
  currentStepIndex: number;
  viewStepIndex: number;
  onOpenStep: (index: number) => void;
  className?: string;
}) {
  const total = path.steps.length;
  const complete = currentStepIndex >= total;

  return (
    <section
      aria-label={`${path.title} learning path`}
      className={cn("glass flex w-[260px] flex-col gap-3 rounded-[24px] p-[18px]", className)}
    >
      <div className="flex flex-col gap-[3px] whitespace-nowrap">
        <h2 className="text-[17px] leading-[normal] font-semibold tracking-[-0.17px] text-foreground">
          {path.title}
        </h2>
        <p className="text-[12.5px] leading-[normal] text-muted-foreground">
          {complete ? "Path complete" : `Step ${currentStepIndex + 1} of ${total}`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(currentStepIndex, total)}
        aria-label="Path progress"
        className="relative h-[6px] w-full overflow-hidden rounded-[3px] bg-foreground/8"
      >
        <motion.div
          className="bg-brand-gradient absolute inset-y-0 left-0 rounded-[3px]"
          initial={false}
          animate={{ width: `${(Math.min(currentStepIndex, total) / total) * 100}%` }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      </div>

      <ol className="flex flex-col gap-3">
        {path.steps.map((step, i) => {
          const state: StepState =
            i < currentStepIndex ? "done" : i === currentStepIndex ? "current" : "locked";
          const active = i === viewStepIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={state === "locked"}
                aria-current={active ? "step" : undefined}
                onClick={() => onOpenStep(i)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-[12px] p-2 text-left transition-[opacity,background-color] duration-200",
                  state === "locked" ? "cursor-not-allowed opacity-50" : "hover:bg-accent",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="learn-step-pill"
                    transition={{ duration: 0.28, ease: EASE }}
                    className="absolute inset-0 rounded-[12px] bg-nav-active shadow-soft"
                  />
                )}
                <StepMarker state={state} number={i + 1} />
                <span className="relative text-[13.5px] leading-[normal] font-medium whitespace-nowrap text-foreground">
                  {step.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StepMarker({ state, number }: { state: StepState; number: number }) {
  return (
    <span className="relative flex size-6 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {state === "done" ? (
          <motion.span
            key="done"
            initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="bg-primary-fill flex size-6 items-center justify-center rounded-[12px]"
          >
            <Icon name="learn-check" size={12} />
          </motion.span>
        ) : (
          <motion.span
            key="number"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className={cn(
              "flex size-6 items-center justify-center rounded-[12px] border-[1.5px] text-[11px] leading-[normal] font-bold transition-colors duration-200",
              state === "current"
                ? "border-brand-orange-strong text-orange-foreground"
                : "border-foreground/15 text-subtle",
            )}
          >
            {number}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
