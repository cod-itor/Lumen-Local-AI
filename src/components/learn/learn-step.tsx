"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Composer } from "@/components/app/composer";
import type { LearningPath, LearningStep } from "@/types/learn";
import { CodeBlock } from "./code-block";
import { PathCard } from "./path-card";
import { QuizCard } from "./quiz-card";

const EASE = [0.22, 1, 0.36, 1] as const;

type QuizState = { questionIndex: number; selectedOptionId?: string };

/**
 * Figma "08 · Learn · Step + quiz": Path Card on the left, the current step's
 * lesson + quiz in the thread, composer at the bottom. Progress is local state
 * seeded from the server (`path.progress`); persist it through src/services later.
 */
export function LearnStep({ path }: { path: LearningPath }) {
  const total = path.steps.length;
  const [currentStep, setCurrentStep] = useState(path.progress.currentStepIndex);
  const [viewStep, setViewStep] = useState(Math.min(path.progress.currentStepIndex, total - 1));
  const [quiz, setQuiz] = useState<QuizState>({
    questionIndex: path.progress.currentQuestionIndex,
    selectedOptionId: path.progress.selectedOptionId,
  });

  const step = path.steps[viewStep];
  const question = step.quiz[quiz.questionIndex];
  const lastQuestion = quiz.questionIndex >= step.quiz.length - 1;
  const lastStep = viewStep >= total - 1;
  const pathDone = currentStep >= total;

  const openStep = (i: number) => {
    if (i > currentStep || i === viewStep) return;
    setViewStep(i);
    setQuiz({ questionIndex: 0 });
  };

  const next = () => {
    if (!lastQuestion) {
      setQuiz({ questionIndex: quiz.questionIndex + 1 });
      return;
    }
    // Finished this step's quiz: mark it done and move on.
    if (viewStep === currentStep) setCurrentStep(currentStep + 1);
    if (!lastStep) {
      setViewStep(viewStep + 1);
      setQuiz({ questionIndex: 0 });
    }
  };

  const nextLabel = !lastQuestion
    ? "Next question"
    : lastStep
      ? pathDone
        ? "Path complete"
        : "Finish path"
      : "Next step";

  return (
    <div className="flex h-full gap-4 pl-4">
      <PathCard
        path={path}
        currentStepIndex={currentStep}
        viewStepIndex={viewStep}
        onOpenStep={openStep}
        className="mt-1 shrink-0 self-start max-[900px]:hidden"
      />

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          <AnimatePresence mode="wait" initial={false}>
            <StepLesson key={step.id} step={step}>
              <QuizCard
                question={question}
                index={quiz.questionIndex}
                total={step.quiz.length}
                selectedOptionId={quiz.selectedOptionId}
                nextLabel={nextLabel}
                onSelect={(id) => setQuiz((q) => ({ ...q, selectedOptionId: q.selectedOptionId ?? id }))}
                onNext={lastStep && lastQuestion && pathDone ? () => {} : next}
              />
            </StepLesson>
          </AnimatePresence>
        </div>

        <div className="mx-auto mt-3 w-full max-w-[max(calc(var(--chat-width)+20px),1080px)] shrink-0 pr-4">
          <Composer placeholder="Ask about this step" showSearch={false} />
          <p className="mt-2 -mb-[5px] text-center text-[11.5px] text-subtle">
            AI can make mistakes. Check sources.
          </p>
        </div>
      </div>
    </div>
  );
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

/** Lesson content for one step; children fade/rise in with a small stagger. */
function StepLesson({ step, children }: { step: LearningStep; children: React.ReactNode }) {
  return (
    <motion.article
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE } }}
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="mx-auto flex w-full max-w-[max(var(--chat-width),1060px)] flex-col gap-[14px] px-4 pt-3 pb-6 min-[860px]:pr-6 min-[860px]:pl-2"
    >
      <motion.h1
        variants={item}
        className="text-[22px] leading-[28px] font-semibold text-foreground"
      >
        {step.title}
      </motion.h1>
      <motion.p variants={item} className="text-[15.5px] leading-[26px] text-foreground">
        {step.intro.map((seg, i) =>
          seg.bold ? (
            <strong key={i} className="font-semibold">
              {seg.text}
            </strong>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </motion.p>
      {step.code && (
        <motion.div variants={item}>
          <CodeBlock code={step.code} />
        </motion.div>
      )}
      <motion.div variants={item}>{children}</motion.div>
    </motion.article>
  );
}
