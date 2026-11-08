"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/chat/markdown";
import { Icon } from "@/components/icon";
import { useMessages, useTranslate } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LearningPathDto, LearningStepDto, PlanDto, QuizDto, Task } from "@/types/api";
import { LiveQuiz } from "./live-quiz";
import { useLearnTask } from "./use-task";

const EASE = [0.22, 1, 0.36, 1] as const;
const btnPrimary =
  "bg-primary-fill rounded-[12px] px-4 py-[9px] text-[13.5px] font-medium whitespace-nowrap transition-[filter] hover:brightness-110 disabled:opacity-40";
const btnGhost =
  "rounded-[12px] border border-border px-4 py-[8px] text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40";

/** One learning path through its states (API_CONTRACT §6.9 state machine; `nextAction` drives the UI). */
export function LearnPath({
  initial,
  onChange,
}: {
  initial: LearningPathDto;
  onChange: (p: LearningPathDto | null, removedId?: string) => void;
}) {
  const m = useMessages().app.learn.live;
  const [path, setPath] = useState(initial);
  const task = useLearnTask();
  const [conflict, setConflict] = useState<string | null>(null);
  // One automatic run per state, so a failed task waits for the user's Retry instead of looping.
  const autoRan = useRef<string | null>(null);

  const update = useCallback(
    (p: LearningPathDto) => {
      setPath(p);
      onChange(p);
    },
    [onChange],
  );

  const call = async (fn: () => Promise<LearningPathDto>) => {
    setConflict(null);
    try {
      update(await fn());
    } catch (e) {
      setConflict(e instanceof ApiError ? e.message : m.failed);
    }
  };

  const runPathTask = useCallback(
    async (kind: Extract<Task, "LEARN_QUESTION" | "LEARN_PLAN">) => {
      const out = await task.run({ task: kind, target: { type: "LEARNING_PATH", id: path.id } });
      if (out?.ok) update(out.result.data as LearningPathDto);
      else if (out && !out.ok && out.code === "CONFLICT") {
        update(await api.get<LearningPathDto>(`/api/learning-paths/${path.id}`));
      }
    },
    [task, path.id, update],
  );

  const key = `${path.state}:${path.interview.length}`;
  useEffect(() => {
    if (autoRan.current === key || task.busy) return;
    if (path.nextAction !== "ASK" && path.nextAction !== "PLAN") return;
    const kind = path.nextAction === "ASK" ? "LEARN_QUESTION" : "LEARN_PLAN";
    const timer = setTimeout(() => {
      autoRan.current = key;
      void runPathTask(kind);
    }, 0);
    return () => clearTimeout(timer);
  }, [key, path.nextAction, task.busy, runPathTask]);

  const remove = async () => {
    if (!window.confirm(m.deleteConfirm)) return;
    try {
      await api.del(`/api/learning-paths/${path.id}`);
      onChange(null, path.id);
    } catch (e) {
      setConflict(e instanceof ApiError ? e.message : m.failed);
    }
  };

  const restart = () => {
    if (!window.confirm(m.restartConfirm)) return;
    autoRan.current = null;
    void call(() => api.post<LearningPathDto>(`/api/learning-paths/${path.id}/restart`));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 pr-4 pb-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[20px] font-semibold text-foreground">{path.plan?.title ?? path.goal}</h1>
          {path.plan && <p className="truncate text-[12.5px] text-muted-foreground">{path.goal}</p>}
        </div>
        {path.state !== "INTERVIEWING" && (
          <button type="button" onClick={restart} disabled={task.busy} className={btnGhost}>
            {m.restart}
          </button>
        )}
        <button type="button" onClick={() => void remove()} disabled={task.busy} className={btnGhost} aria-label={m.delete}>
          {m.delete}
        </button>
      </header>

      {conflict && <p role="alert" className="pb-2 text-[13px] text-danger">{conflict}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto pr-4 pb-8 [scrollbar-width:thin]">
        {task.busy && (path.nextAction === "ASK" || path.nextAction === "PLAN") ? (
          <Working label={path.nextAction === "ASK" ? m.working.question : m.working.plan} />
        ) : task.error && (path.nextAction === "ASK" || path.nextAction === "PLAN") ? (
          <TaskError
            code={task.error.code}
            message={task.error.message}
            onRetry={() => void runPathTask(path.nextAction === "ASK" ? "LEARN_QUESTION" : "LEARN_PLAN")}
          />
        ) : path.state === "INTERVIEWING" ? (
          <Interview path={path} onPath={update} />
        ) : path.state === "AWAITING_APPROVAL" && path.plan ? (
          <PlanReview path={path} onPath={update} />
        ) : path.state === "ACTIVE" || path.state === "COMPLETED" ? (
          <Study path={path} onPath={update} />
        ) : null}
      </div>
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-[13.5px] text-subtle" aria-live="polite">
      <span className="size-[7px] animate-pulse rounded-full bg-foreground/50" />
      {label}
    </div>
  );
}

function TaskError({ code, message, onRetry }: { code: string; message: string; onRetry: () => void }) {
  const m = useMessages().app.learn.live;
  const text = code === "NO_MODEL" ? m.noModel : code === "GUARD_BLOCKED" ? message : message || m.failed;
  return (
    <div className="flex flex-col items-start gap-2 py-4">
      <p className="text-[13.5px] text-muted-foreground">{text}</p>
      {code !== "GUARD_BLOCKED" && code !== "NO_MODEL" && (
        <button type="button" onClick={onRetry} className={btnGhost}>
          {m.retry}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- interview

function Interview({ path, onPath }: { path: LearningPathDto; onPath: (p: LearningPathDto) => void }) {
  const m = useMessages().app.learn.live;
  const t = useTranslate();
  const pending = path.interview.at(-1)?.answer === null ? path.interview.at(-1)! : null;
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (answer: string) => {
    const a = answer.trim();
    if (!a || saving) return;
    setSaving(true);
    setError(null);
    try {
      onPath(await api.post<LearningPathDto>(`/api/learning-paths/${path.id}/answers`, { answer: a }));
      setText("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.failed);
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    try {
      onPath(await api.post<LearningPathDto>(`/api/learning-paths/${path.id}/skip-interview`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-[640px] flex-col gap-4">
      <p className="text-[13.5px] text-muted-foreground">{m.interviewIntro}</p>
      {path.interview
        .filter((it) => it.answer !== null)
        .map((it, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="text-[13px] text-muted-foreground">{it.question}</span>
            <span className="self-end rounded-[16px] bg-surface-muted px-3.5 py-2 text-[14px] text-foreground">{it.answer}</span>
          </div>
        ))}
      {pending && (
        <motion.section
          key={path.interview.length}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="glass flex flex-col gap-3 rounded-[20px] p-[18px]"
        >
          <span className="text-[12px] text-muted-foreground tabular-nums">
            {t("app.learn.live.questionN", { n: String(path.interview.length) })}
          </span>
          <p className="text-[15px] font-semibold text-foreground">{pending.question}</p>
          <div className="flex flex-wrap gap-2">
            {pending.options.map((o) => (
              <button key={o} type="button" disabled={saving} onClick={() => void send(o)} className={btnGhost}>
                {o}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            className="flex gap-2"
          >
            <input
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              placeholder={m.ownAnswer}
              aria-label={m.ownAnswer}
              className="min-w-0 flex-1 rounded-[12px] border border-border bg-transparent px-3 py-2 text-[14px] text-foreground outline-none placeholder:text-placeholder focus:border-foreground/40"
            />
            <button type="submit" disabled={!text.trim() || saving} className={btnPrimary}>
              {m.send}
            </button>
          </form>
        </motion.section>
      )}
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <button type="button" onClick={() => void skip()} disabled={saving} className="self-start text-[13px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {m.skipInterview}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- plan approval

function PlanReview({ path, onPath }: { path: LearningPathDto; onPath: (p: LearningPathDto) => void }) {
  const m = useMessages().app.learn.live;
  const [plan, setPlan] = useState<PlanDto>(path.plan!);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = (i: number, field: "title" | "summary", v: string) => {
    setDirty(true);
    setPlan((p) => ({ ...p, steps: p.steps.map((s, j) => (j === i ? { ...s, [field]: v } : s)) }));
  };

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      if (dirty) await api.put<LearningPathDto>(`/api/learning-paths/${path.id}/plan`, { plan });
      onPath(await api.post<LearningPathDto>(`/api/learning-paths/${path.id}/approve`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold text-foreground">{plan.title}</h2>
        <p className="text-[13px] text-muted-foreground">
          {m.levels[plan.level]} · {m.planIntro}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {plan.steps.map((s, i) => (
          <li key={i} className="glass flex gap-3 rounded-[18px] p-4">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[12px] border-[1.5px] border-foreground/15 text-[11px] font-bold text-subtle">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input
                value={s.title}
                maxLength={80}
                onChange={(e) => edit(i, "title", e.target.value)}
                aria-label={m.stepTitle}
                className="rounded-[8px] bg-transparent text-[14.5px] font-semibold text-foreground outline-none focus:bg-foreground/5"
              />
              <textarea
                value={s.summary}
                maxLength={300}
                rows={2}
                onChange={(e) => edit(i, "summary", e.target.value)}
                aria-label={m.stepSummary}
                className="resize-none rounded-[8px] bg-transparent text-[13px] leading-[19px] text-muted-foreground outline-none focus:bg-foreground/5"
              />
              <ul className="flex flex-col gap-0.5 pl-4 text-[12.5px] text-foreground-secondary [list-style:disc]">
                {s.objectives.map((o, j) => (
                  <li key={j}>{o}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void approve()} disabled={saving} className={btnPrimary}>
          {m.approve}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- study

function Study({ path, onPath }: { path: LearningPathDto; onPath: (p: LearningPathDto) => void }) {
  const m = useMessages().app.learn.live;
  const t = useTranslate();
  const current = path.steps.find((s) => s.status === "CURRENT") ?? path.steps.at(-1)!;
  const [viewId, setViewId] = useState(current.id);
  const step = path.steps.find((s) => s.id === viewId) ?? current;
  const total = path.steps.length;

  const setStep = (s: LearningStepDto) => onPath({ ...path, steps: path.steps.map((x) => (x.id === s.id ? s : x)) });

  return (
    <div className="flex gap-6 max-[900px]:flex-col">
      <section className="glass flex w-[240px] shrink-0 flex-col gap-3 self-start rounded-[24px] p-[18px] max-[900px]:w-full">
        <p className="text-[12.5px] text-muted-foreground">
          {path.state === "COMPLETED"
            ? m.complete
            : t("app.learn.stepOf", { current: String(current.position), total: String(total) })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={path.progress.done}
          aria-label={m.progressLabel}
          className="relative h-[6px] w-full overflow-hidden rounded-[3px] bg-foreground/8"
        >
          <motion.div
            className="bg-brand-gradient absolute inset-y-0 left-0 rounded-[3px]"
            initial={false}
            animate={{ width: `${(path.progress.done / Math.max(1, total)) * 100}%` }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        </div>
        <ol className="flex flex-col gap-1.5">
          {path.steps.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={s.status === "LOCKED"}
                aria-current={s.id === step.id ? "step" : undefined}
                onClick={() => setViewId(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[12px] p-2 text-left transition-colors",
                  s.status === "LOCKED" ? "cursor-not-allowed opacity-50" : "hover:bg-accent",
                  s.id === step.id && "bg-nav-active shadow-soft",
                )}
              >
                {s.status === "DONE" ? (
                  <span className="bg-primary-fill flex size-6 shrink-0 items-center justify-center rounded-[12px]">
                    <Icon name="learn-check" size={12} />
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-[12px] border-[1.5px] text-[11px] font-bold",
                      s.status === "CURRENT" ? "border-brand-orange-strong text-orange-foreground" : "border-foreground/15 text-subtle",
                    )}
                  >
                    {s.position}
                  </span>
                )}
                <span className="line-clamp-2 text-[13px] font-medium text-foreground">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <Lesson key={step.id} step={step} onStep={setStep} onPath={onPath} pathId={path.id} />
      </AnimatePresence>
    </div>
  );
}

function Lesson({
  step,
  pathId,
  onStep,
  onPath,
}: {
  step: LearningStepDto;
  pathId: string;
  onStep: (s: LearningStepDto) => void;
  onPath: (p: LearningPathDto) => void;
}) {
  const m = useMessages().app.learn.live;
  const task = useLearnTask();
  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const tried = useRef(false);

  const write = useCallback(async () => {
    const out = await task.run({ task: "LEARN_STEP", target: { type: "LEARNING_STEP", id: step.id } });
    if (out?.ok) onStep(out.result.data as LearningStepDto);
  }, [task, step.id, onStep]);

  useEffect(() => {
    if (tried.current || step.status === "LOCKED" || step.contentStatus === "READY") return;
    const timer = setTimeout(() => {
      tried.current = true;
      void write();
    }, 0);
    return () => clearTimeout(timer);
  }, [step.status, step.contentStatus, write]);

  const newQuiz = async () => {
    setQuiz(null);
    const out = await task.run({ task: "QUIZ", target: { type: "LEARNING_STEP", id: step.id }, taskInput: { count: 5 } });
    if (out?.ok) setQuiz(out.result.data as QuizDto);
  };

  const afterQuiz = async () => {
    onPath(await api.get<LearningPathDto>(`/api/learning-paths/${pathId}`));
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE } }}
      transition={{ duration: 0.28, ease: EASE }}
      className="flex min-w-0 max-w-[var(--chat-width)] flex-1 flex-col gap-4"
    >
      <h2 className="text-[22px] leading-[28px] font-semibold text-foreground">{step.title}</h2>
      <p className="text-[13.5px] text-muted-foreground">{step.summary}</p>
      {step.contentStatus === "READY" && step.content ? (
        <Markdown text={step.content} />
      ) : task.busy && !quiz ? (
        <Working label={m.working.lesson} />
      ) : task.error ? (
        <TaskError code={task.error.code} message={task.error.message} onRetry={() => void write()} />
      ) : null}

      {step.contentStatus === "READY" && (
        <div className="flex flex-col gap-3 pt-2">
          {quiz ? (
            <LiveQuiz quiz={quiz} onSubmitted={() => void afterQuiz()} onRetake={() => void newQuiz()} />
          ) : task.busy ? (
            <Working label={m.working.quiz} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void newQuiz()} className={btnPrimary}>
                {step.bestScore === null ? m.takeQuiz : m.retakeQuiz}
              </button>
              {step.bestScore !== null && (
                <span className="text-[12.5px] text-muted-foreground tabular-nums">
                  {m.bestScore} {Math.round(step.bestScore * 100)}%
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}
