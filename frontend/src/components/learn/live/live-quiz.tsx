"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMessages, useTranslate } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { QuizDto, QuizResultDto } from "@/types/api";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Answer every question, then submit; the answers and explanations arrive with the result (API_CONTRACT §6.9). */
export function LiveQuiz({
  quiz,
  onSubmitted,
  onRetake,
}: {
  quiz: QuizDto;
  onSubmitted: (r: QuizResultDto) => void;
  onRetake: () => void;
}) {
  const m = useMessages().app.learn;
  const live = m.live;
  const t = useTranslate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [result, setResult] = useState<QuizResultDto | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = quiz.questions[index];
  const last = index === quiz.questions.length - 1;
  const selected = answers[index];

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const r = await api.post<QuizResultDto>(`/api/quizzes/${quiz.id}/submit`, { answers });
      setResult(r);
      onSubmitted(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : live.failed);
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <section aria-label={m.quiz} className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <p className={cn("text-[15px] font-semibold", result.passed ? "text-success-foreground" : "text-orange-foreground")}>
          {t(result.passed ? "app.learn.live.passed" : "app.learn.live.notPassed", {
            score: String(Math.round(result.score * 100)),
          })}
        </p>
        <ol className="flex flex-col gap-3">
          {result.results.map((r) => {
            const question = quiz.questions[r.index];
            return (
              <li key={r.index} className="flex flex-col gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <span className="flex items-start gap-2 text-[14px] font-medium text-foreground">
                  {r.correct ? (
                    <Icon name="learn-check-md" size={15} className="mt-0.5 shrink-0 text-success-foreground" />
                  ) : (
                    <X size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden />
                  )}
                  {question.question}
                </span>
                {!r.correct && (
                  <span className="pl-6 text-[13px] text-foreground">
                    {live.correctAnswer} {question.options[r.correctIndex]}
                  </span>
                )}
                {r.explanation && <span className="pl-6 text-[13px] text-muted-foreground">{r.explanation}</span>}
                {r.evidence && (
                  <span className="pl-6 text-[12.5px] text-subtle italic">
                    {live.fromLesson} “{r.evidence}”
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex gap-2">
          <button type="button" onClick={onRetake} className="rounded-[12px] border border-border px-4 py-[8px] text-[13px] font-medium text-foreground hover:bg-accent">
            {live.retakeQuiz}
          </button>
        </div>
      </section>
    );
  }

  return (
    <motion.section layout aria-label={m.quiz} className="glass flex flex-col gap-[10px] overflow-hidden rounded-[20px] p-[18px]">
      <div className="flex items-start">
        <span className="text-[13px] font-semibold text-orange-foreground">{m.quiz}</span>
        <div className="flex-1" />
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {t("app.learn.questionOf", { index: String(index + 1), total: String(quiz.questions.length) })}
        </span>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="flex flex-col gap-[10px]"
        >
          <p className="text-[15px] font-semibold text-foreground">{q.question}</p>
          <div role="radiogroup" aria-label={q.question} className="flex flex-col gap-[10px]">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected === i}
                onClick={() => setAnswers((a) => a.map((x, j) => (j === index ? i : x)))}
                className={cn(
                  "flex w-full items-center rounded-[14px] border px-[14px] py-[10px] text-left text-[14px] text-foreground transition-colors",
                  selected === i
                    ? "border-brand-orange-strong bg-brand-orange-soft"
                    : "border-foreground/10 bg-white/50 hover:border-foreground/20 dark:bg-white/6",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        {index > 0 && (
          <button type="button" onClick={() => setIndex(index - 1)} className="rounded-[12px] border border-border px-4 py-[8px] text-[13px] font-medium text-foreground hover:bg-accent">
            {live.back}
          </button>
        )}
        <button
          type="button"
          disabled={selected === null || sending}
          onClick={() => (last ? void submit() : setIndex(index + 1))}
          className="bg-primary-fill rounded-[12px] px-4 py-[9px] text-[13.5px] font-medium transition-[filter] hover:brightness-110 disabled:opacity-40"
        >
          {last ? live.submit : m.nextQuestion}
        </button>
      </div>
    </motion.section>
  );
}
