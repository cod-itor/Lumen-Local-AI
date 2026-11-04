"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types/learn";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Figma "Quiz Card": question, options with correct/incorrect feedback, next action. */
export function QuizCard({
  question,
  index,
  total,
  selectedOptionId,
  nextLabel,
  onSelect,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selectedOptionId?: string;
  /** "Next question", "Next step", … */
  nextLabel: string;
  onSelect: (optionId: string) => void;
  onNext: () => void;
}) {
  const answered = selectedOptionId !== undefined;
  const wrong = answered && selectedOptionId !== question.correctOptionId;

  return (
    <motion.section
      layout
      transition={{ layout: { duration: 0.28, ease: EASE } }}
      aria-label="Quiz"
      className="glass flex w-full flex-col gap-[10px] overflow-hidden rounded-[20px] p-[18px]"
    >
      <motion.div layout="position" className="flex items-start">
        <span className="text-[13px] leading-[normal] font-semibold whitespace-nowrap text-orange-foreground">
          Quiz
        </span>
        <div className="flex-1" />
        <span className="text-[12px] leading-[normal] whitespace-nowrap text-muted-foreground tabular-nums">
          {index + 1} of {total}
        </span>
      </motion.div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="flex flex-col gap-[10px]"
        >
          <p className="text-[15px] leading-[normal] font-semibold text-foreground">{question.prompt}</p>

          <div role="radiogroup" aria-label={question.prompt} className="flex flex-col gap-[10px]">
            {question.options.map((opt) => {
              const isCorrect = opt.id === question.correctOptionId;
              const isSelected = opt.id === selectedOptionId;
              const showCorrect = answered && isCorrect;
              const showWrong = answered && isSelected && !isCorrect;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={answered}
                  onClick={() => onSelect(opt.id)}
                  whileTap={answered ? undefined : { scale: 0.985 }}
                  animate={showWrong ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={cn(
                    "flex w-full items-center gap-[10px] rounded-[14px] border px-[14px] py-[10px] text-left transition-[background-color,border-color,opacity] duration-200",
                    showCorrect
                      ? "border-success-foreground bg-success/12"
                      : showWrong
                        ? "border-danger bg-danger/12"
                        : "border-foreground/10 bg-white/50 dark:bg-white/6",
                    !answered && "cursor-pointer hover:border-foreground/20 hover:bg-white/80 dark:hover:bg-white/10",
                  )}
                >
                  <span className="font-mono text-[13px] leading-[normal] whitespace-pre-wrap text-foreground">
                    {opt.label}
                  </span>
                  <div className="flex-1" />
                  <AnimatePresence initial={false}>
                    {(showCorrect || showWrong) && (
                      <motion.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ duration: 0.24, ease: EASE, delay: showCorrect && wrong ? 0.08 : 0 }}
                        className={cn(
                          "flex shrink-0",
                          showCorrect ? "text-success-foreground" : "text-danger",
                        )}
                      >
                        {showCorrect ? (
                          <Icon name="learn-check-md" size={15} />
                        ) : (
                          <X size={15} strokeWidth={1.75} aria-hidden />
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {answered && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="flex flex-col items-start gap-[10px]"
              >
                {(wrong || question.explanation) && (
                  <p aria-live="polite" className="text-[13px] leading-[normal] text-muted-foreground">
                    {wrong && "Not quite. The correct answer is highlighted. "}
                    {question.explanation}
                  </p>
                )}
                <motion.button
                  type="button"
                  onClick={onNext}
                  whileTap={{ scale: 0.96 }}
                  className="bg-primary-fill rounded-[12px] px-4 py-[9px] text-[13.5px] leading-[normal] font-medium whitespace-nowrap transition-[filter] hover:brightness-110"
                >
                  {nextLabel}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}
