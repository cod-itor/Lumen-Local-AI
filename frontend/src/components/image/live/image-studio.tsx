"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "@/components/app/composer";
import { ShellRightPanel } from "@/components/app/right-panel";
import { Icon } from "@/components/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { followJob, useImages } from "@/lib/images";
import { cn } from "@/lib/utils";
import { useLearnTask } from "@/components/learn/live/use-task";
import type {
  AspectRatio,
  ImageClarifyResult,
  ImageDto,
  ImagePromptResult,
  ImageSessionDto,
  PageResponse,
} from "@/types/api";
import { EASE, riseItem } from "../motion";

const RATIOS: AspectRatio[] = ["SQUARE", "PORTRAIT", "LANDSCAPE", "WIDE"];

type Question = ImageClarifyResult["questions"][number];
type Step =
  | { kind: "thinking" }
  | { kind: "clarify"; questions: Question[] }
  | { kind: "writing" }
  | { kind: "approval"; result: ImagePromptResult }
  | { kind: "working"; label: "generate" | "bg"; progress: number; stage: string | null; total: number }
  | { kind: "error"; text: string; retry: (() => void) | null };
type Flow = { request: string; answers: Record<string, string>; step: Step } | null;

/** Image tab (FRONTEND.md §7.5): clarify → approve the prompt → generate on the host; the session's gallery. */
export function ImageStudio() {
  return (
    <Suspense fallback={null}>
      <StudioRoute />
    </Suspense>
  );
}

function StudioRoute() {
  const s = useSearchParams().get("s");
  // A session the studio just created changes the URL without remounting (its flow keeps running).
  const [view, setView] = useState({ s, key: 0, adopted: null as string | null });
  if (view.s !== s) {
    setView({ s, key: s && s === view.adopted ? view.key : view.key + 1, adopted: view.adopted });
  }
  const onCreated = useCallback((id: string) => setView((v) => ({ ...v, adopted: id })), []);
  return <Studio key={view.key} initialSession={s} onCreated={onCreated} />;
}

function Studio({ initialSession, onCreated }: { initialSession: string | null; onCreated: (id: string) => void }) {
  const msgs = useMessages();
  const m = msgs.app.image.live;
  const store = useImages();
  const task = useLearnTask();
  const [sessionId, setSessionId] = useState(initialSession);
  const [images, setImages] = useState<ImageDto[]>([]);
  const [flow, setFlow] = useState<Flow>(null);
  const [ratio, setRatio] = useState<AspectRatio>("SQUARE");
  const [count, setCount] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canGenerate = store.features?.images ?? false;

  const loadImages = useCallback(async (id: string) => {
    const page = await api.get<PageResponse<ImageDto>>(`/api/images?sessionId=${id}&size=100`).catch(() => null);
    if (page) setImages([...page.items].reverse());
  }, []);

  useEffect(() => {
    if (!initialSession) return;
    const t = setTimeout(() => void loadImages(initialSession), 0);
    return () => clearTimeout(t);
  }, [initialSession, loadImages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [images.length, flow?.step.kind]);

  const setStep = (step: Step) => setFlow((f) => (f ? { ...f, step } : f));

  const taskError = useCallback(
    (code: string, message: string, retry: () => void): Step => {
      if (code === "GUARD_BLOCKED") return { kind: "error", text: message || m.blocked, retry: null };
      if (code === "NO_MODEL") return { kind: "error", text: m.noModel, retry: null };
      return { kind: "error", text: format(m.failed, { reason: message }), retry };
    },
    [m],
  );

  const ensureSession = async (request: string): Promise<string> => {
    if (sessionId) return sessionId;
    const s = await api.post<ImageSessionDto>("/api/image-sessions", { title: request.slice(0, 80) });
    store.upsert(s);
    setSessionId(s.id);
    onCreated(s.id);
    window.history.replaceState(null, "", `/image?s=${s.id}`);
    return s.id;
  };

  const writePrompt = async (sid: string, request: string, answers: Record<string, string>) => {
    setFlow({ request, answers, step: { kind: "writing" } });
    const out = await task.run({
      task: "IMAGE_PROMPT",
      target: { type: "IMAGE_SESSION", id: sid },
      taskInput: { request, answers },
    });
    if (!out) return setStep(taskError("NO_MODEL", "", () => undefined));
    if (!out.ok) return setStep(taskError(out.code, out.message, () => void writePrompt(sid, request, answers)));
    setStep({ kind: "approval", result: out.result.data as ImagePromptResult });
  };

  const clarify = async (sid: string, request: string) => {
    setFlow({ request, answers: {}, step: { kind: "thinking" } });
    const out = await task.run({
      task: "IMAGE_CLARIFY",
      target: { type: "IMAGE_SESSION", id: sid },
      taskInput: { request },
    });
    if (!out) return setStep(taskError("NO_MODEL", "", () => undefined));
    if (!out.ok) return setStep(taskError(out.code, out.message, () => void clarify(sid, request)));
    const questions = (out.result.data as ImageClarifyResult).questions ?? [];
    if (questions.length === 0) return void writePrompt(sid, request, {});
    setStep({ kind: "clarify", questions });
  };

  const submit = async (text: string) => {
    const request = text.trim().slice(0, 500);
    if (!request || busy) return;
    setFlow({ request, answers: {}, step: { kind: "thinking" } });
    try {
      const sid = await ensureSession(request);
      await clarify(sid, request);
    } catch (e) {
      setStep({ kind: "error", text: e instanceof ApiError ? e.message : String(e), retry: null });
    }
  };

  const runJob = async (start: () => Promise<{ jobId: string }>, label: "generate" | "bg", total: number) => {
    setStep({ kind: "working", label, progress: 0, stage: "QUEUED", total });
    try {
      const { jobId } = await start();
      const job = await followJob(jobId, (progress, stage) =>
        setStep({ kind: "working", label, progress, stage, total }),
      );
      if (sessionId) await loadImages(sessionId);
      if (job?.status === "SUCCEEDED") {
        setFlow(null);
        const created = (job.result as { images?: ImageDto[] } | null)?.images ?? [];
        if (label === "bg" && created[0]) setSelectedId(created[0].id);
      } else {
        setStep({ kind: "error", text: format(m.failed, { reason: job?.error ?? "" }), retry: null });
      }
    } catch (e) {
      const text =
        e instanceof ApiError && e.code === "FEATURE_UNAVAILABLE"
          ? label === "bg"
            ? m.bgUnavailable
            : m.needsHost
          : e instanceof ApiError
            ? e.message
            : String(e);
      setStep({ kind: "error", text, retry: null });
    }
  };

  const generate = (prompt: string, originalPrompt: string) => {
    const sid = sessionId;
    if (!sid) return;
    void runJob(
      () =>
        api.post<{ jobId: string }>("/api/images/generate", {
          sessionId: sid,
          prompt: prompt.trim(),
          originalPrompt,
          aspectRatio: ratio,
          count,
        }),
      "generate",
      count,
    );
  };

  const variations = (img: ImageDto) => {
    setFlow({ request: img.originalPrompt ?? img.prompt, answers: {}, step: { kind: "thinking" } });
    void runJob(() => api.post<{ jobId: string }>(`/api/images/${img.id}/variations`, { count }), "generate", count);
  };

  const removeBg = (img: ImageDto) => {
    setFlow({ request: img.originalPrompt ?? img.prompt, answers: {}, step: { kind: "thinking" } });
    void runJob(() => api.post<{ jobId: string }>(`/api/images/${img.id}/remove-background`), "bg", 1);
  };

  const deleteImage = async (img: ImageDto) => {
    await api.del(`/api/images/${img.id}`).catch(() => undefined);
    setImages((list) => list.filter((x) => x.id !== img.id));
    setSelectedId(null);
  };

  const busy = flow !== null && ["thinking", "writing", "working"].includes(flow.step.kind);
  const selected = images.find((i) => i.id === selectedId) ?? null;
  const batches = groupBatches(images);

  return (
    <>
      <div className="flex h-full flex-col">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
          <div className="mx-auto flex w-full max-w-(--chat-width) flex-col gap-7 px-1 pt-3 pb-3">
            {batches.length === 0 && !flow && <Empty />}
            {batches.map((b) => (
              <motion.div key={b.key} initial="hidden" animate="show" variants={riseItem} className="flex flex-col gap-4">
                <UserBubble text={b.request} />
                <div className="grid grid-cols-4 gap-[10px]">
                  {b.images.map((img) => (
                    <Tile key={img.id} image={img} selected={img.id === selectedId} onSelect={() => setSelectedId(img.id)} />
                  ))}
                </div>
              </motion.div>
            ))}
            {flow && (
              <motion.div initial="hidden" animate="show" variants={riseItem} className="flex flex-col gap-4">
                <UserBubble text={flow.request} />
                <FlowView
                  flow={flow}
                  stage={task.stage}
                  canGenerate={canGenerate}
                  onAnswer={(answers) => sessionId && void writePrompt(sessionId, flow.request, answers)}
                  onGenerate={generate}
                  onCancel={() => setFlow(null)}
                />
              </motion.div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[calc(var(--chat-width)+20px)] shrink-0">
          <Composer
            placeholder={msgs.app.image.placeholder}
            showSearch={false}
            attachIcon="img-imgplus"
            attachLabel={msgs.app.image.addReference}
            busy={busy}
            leading={
              <>
                <RatioChip value={ratio} onChange={setRatio} />
                <button
                  type="button"
                  aria-label={m.countLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCount((c) => (c % 4) + 1);
                  }}
                  className="rounded-full border border-border px-3 py-[7px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {format(m.count, { count })}
                </button>
              </>
            }
            onSubmit={(t) => void submit(t)}
          />
          <p className="pt-[3px] text-center text-[11.5px] text-subtle">
            {store.features && !canGenerate ? m.needsHost : msgs.app.image.disclaimer}
          </p>
        </div>
      </div>

      <ShellRightPanel
        open={!!selected}
        width={300}
        label={msgs.app.image.gallery.selected}
        panelId="Selected image"
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <SelectedPanel
            image={selected}
            busy={busy}
            canGenerate={canGenerate}
            canRemoveBg={store.features?.bgRemoval ?? false}
            onClose={() => setSelectedId(null)}
            onVariations={() => variations(selected)}
            onRemoveBg={() => removeBg(selected)}
            onDelete={() => void deleteImage(selected)}
          />
        )}
      </ShellRightPanel>
    </>
  );
}

/** Consecutive images from one request (same original prompt, created together) form one thread item. */
function groupBatches(images: ImageDto[]) {
  const out: { key: string; request: string; images: ImageDto[] }[] = [];
  for (const img of images) {
    const request = img.originalPrompt ?? img.prompt;
    const last = out.at(-1);
    const near = last && Math.abs(Date.parse(img.createdAt) - Date.parse(last.images.at(-1)!.createdAt)) < 120_000;
    if (last && near && last.request === request && last.images.length < 4) last.images.push(img);
    else out.push({ key: img.id, request, images: [img] });
  }
  return out;
}

function Empty() {
  const m = useMessages().app.image.live;
  return (
    <div className="flex flex-col items-center gap-2 pt-24 text-center">
      <Icon name="img-sparkles" size={22} className="text-orange-foreground" />
      <h1 className="text-[22px] font-semibold tracking-[-0.33px] text-foreground">{m.emptyTitle}</h1>
      <p className="max-w-[420px] text-[14px] leading-[21px] text-muted-foreground">{m.emptyHint}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] rounded-[22px] bg-surface-muted px-[18px] py-[11px] text-[15px] leading-[22px] text-foreground">
        {text}
      </p>
    </div>
  );
}

function Tile({ image, selected, onSelect }: { image: ImageDto; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={image.prompt}
      className={cn(
        "relative block aspect-square overflow-hidden rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        image.kind === "BG_REMOVED" && "bg-[repeating-conic-gradient(var(--accent)_0_25%,transparent_0_50%)] bg-[length:16px_16px]",
      )}
    >
      <Image src={image.url} alt={image.prompt} fill sizes="172px" unoptimized className="object-cover" />
      {selected && (
        <span className="pointer-events-none absolute inset-0 rounded-[16px] border-3 border-brand-orange-strong" />
      )}
    </motion.button>
  );
}

function FlowView({
  flow,
  stage,
  canGenerate,
  onAnswer,
  onGenerate,
  onCancel,
}: {
  flow: NonNullable<Flow>;
  stage: string | null;
  canGenerate: boolean;
  onAnswer: (answers: Record<string, string>) => void;
  onGenerate: (prompt: string, original: string) => void;
  onCancel: () => void;
}) {
  const m = useMessages().app.image.live;
  const s = flow.step;
  switch (s.kind) {
    case "thinking":
    case "writing":
      return <Status text={s.kind === "thinking" ? m.thinking : m.writingPrompt} detail={stage} />;
    case "clarify":
      return <Clarify questions={s.questions} onDone={onAnswer} />;
    case "approval":
      return (
        <Approval
          result={s.result}
          request={flow.request}
          canGenerate={canGenerate}
          onGenerate={onGenerate}
          onCancel={onCancel}
        />
      );
    case "working":
      return <Working step={s} />;
    case "error":
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-border px-4 py-3 text-[14px] text-foreground">
          <span className="flex-1">{s.text}</span>
          {s.retry && (
            <button
              type="button"
              onClick={s.retry}
              className="rounded-[12px] border border-border px-3 py-[7px] text-[13px] font-medium hover:bg-accent"
            >
              {m.retry}
            </button>
          )}
        </div>
      );
  }
}

function Status({ text, detail }: { text: string; detail?: string | null }) {
  return (
    <div role="status" className="flex items-center gap-2 text-[14px] text-muted-foreground">
      <motion.span
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        className="size-2 rounded-full bg-brand-orange-strong"
      />
      {text}
      {detail === "LOADING_MODEL" && <span className="text-subtle">· {detail.toLowerCase().replace("_", " ")}</span>}
    </div>
  );
}

function Clarify({ questions, onDone }: { questions: Question[]; onDone: (answers: Record<string, string>) => void }) {
  const m = useMessages().app.image.live;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <div className="flex flex-col gap-5">
      {questions.map((q) => (
        <div key={q.id} className="flex flex-col gap-[10px]">
          <p className="text-[15.5px] leading-[26px] text-foreground">{q.question}</p>
          <div className="flex flex-wrap gap-[6px]" role="radiogroup" aria-label={q.question}>
            {q.options.map((o) => {
              const on = answers[q.id] === o;
              return (
                <motion.button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                  className={cn(
                    "rounded-full px-[13px] py-[7px] text-[13px] font-medium transition-[background,color,box-shadow] duration-200",
                    on ? "bg-primary-fill" : "border border-border text-foreground hover:bg-accent",
                  )}
                >
                  {o}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDone(answers)}
          className="bg-primary-fill rounded-[12px] px-4 py-[9px] text-[13.5px] font-medium hover:brightness-105"
        >
          {m.continue}
        </button>
        <button
          type="button"
          onClick={() => onDone({})}
          className="rounded-full px-3 py-[9px] text-[13.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {m.skip}
        </button>
      </div>
    </div>
  );
}

function Approval({
  result,
  request,
  canGenerate,
  onGenerate,
  onCancel,
}: {
  result: ImagePromptResult;
  request: string;
  canGenerate: boolean;
  onGenerate: (prompt: string, original: string) => void;
  onCancel: () => void;
}) {
  const msgs = useMessages();
  const m = msgs.app.image.approval;
  const live = msgs.app.image.live;
  const [prompt, setPrompt] = useState(result.prompt);
  const [editing, setEditing] = useState(false);
  const original = result.originalPromptEnglish || result.originalPrompt || request;
  return (
    <div className="glass flex w-full flex-col gap-3 rounded-[20px] p-4">
      <div className="flex items-center gap-[7px]">
        <Icon name="img-sparkles" size={14} className="text-orange-foreground" />
        <span className="text-[13px] font-semibold text-foreground">{m.title}</span>
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={prompt}
          maxLength={1000}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label={m.editPrompt}
          className="field-sizing-content w-full resize-none rounded-[12px] border border-border bg-transparent px-3 py-2 text-[14.5px] leading-[22px] text-foreground-tertiary outline-none focus:shadow-[0_0_0_3px_var(--brand-blue-soft)]"
        />
      ) : (
        <p className="text-[14.5px] leading-[22px] text-foreground-tertiary">{prompt}</p>
      )}
      {!canGenerate && <p className="text-[12.5px] leading-[18px] text-muted-foreground">{live.needsHost}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={!canGenerate || !prompt.trim()}
          onClick={() => onGenerate(prompt, request)}
          className="bg-primary-fill rounded-[12px] px-4 py-[9px] text-[13.5px] font-medium transition-[filter,opacity] hover:brightness-105 disabled:opacity-50"
        >
          {m.generate}
        </motion.button>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-pressed={editing}
          className={cn(
            "rounded-[12px] border border-border px-4 py-[9px] text-[13.5px] font-medium text-foreground hover:bg-accent",
            editing && "bg-accent",
          )}
        >
          {editing ? msgs.common.done : m.edit}
        </button>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => onGenerate(original, request)}
          className="rounded-[12px] border border-border px-4 py-[9px] text-[13.5px] font-medium text-foreground hover:bg-accent disabled:opacity-50"
        >
          {live.useOriginal}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-[9px] text-[13.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {msgs.common.cancel}
        </button>
      </div>
    </div>
  );
}

function Working({ step }: { step: Extract<Step, { kind: "working" }> }) {
  const m = useMessages().app.image.live;
  const done = Math.min(step.total, Math.floor(step.progress * step.total));
  const text =
    step.label === "bg"
      ? m.removingBg
      : step.stage === "QUEUED"
        ? m.queued
        : step.stage === "LOADING_MODEL"
          ? m.loadingModel
          : format(m.generatingStep, { done: Math.min(step.total, done + 1), total: step.total });
  return (
    <div className="flex flex-col gap-[14px]">
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-medium text-foreground">{text}</span>
        <div className="relative h-1 w-40 overflow-hidden rounded-full bg-accent">
          <motion.div
            animate={{ width: `${Math.max(4, step.progress * 100)}%` }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute inset-y-0 left-0 rounded-full bg-brand-orange-strong"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-[10px]" aria-hidden>
        {Array.from({ length: step.total }, (_, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-[16px] bg-surface-muted">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
              className="absolute inset-0 bg-[linear-gradient(100deg,transparent_20%,var(--accent)_50%,transparent_80%)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RatioChip({ value, onChange }: { value: AspectRatio; onChange: (v: AspectRatio) => void }) {
  const msgs = useMessages().app.image;
  const label = msgs.live.ratios[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={format(msgs.aspectRatioValue, { value: label })}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-[6px] rounded-full border border-border px-3 py-[7px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        {label}
        <Icon name="chev" size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{msgs.aspectRatio}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as AspectRatio)}>
            {RATIOS.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {msgs.live.ratios[r]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const actionClass = cn(
  "flex min-w-0 items-center justify-center gap-[6px] rounded-[14px] border border-border px-3 py-[10px]",
  "text-center text-[12.5px] leading-[16px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50",
);

function SelectedPanel({
  image,
  busy,
  canGenerate,
  canRemoveBg,
  onClose,
  onVariations,
  onRemoveBg,
  onDelete,
}: {
  image: ImageDto;
  busy: boolean;
  canGenerate: boolean;
  canRemoveBg: boolean;
  onClose: () => void;
  onVariations: () => void;
  onRemoveBg: () => void;
  onDelete: () => void;
}) {
  const msgs = useMessages().app.image;
  const m = msgs.gallery;
  return (
    <div className="flex h-full flex-col gap-[14px] overflow-y-auto p-[18px]">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[16px] font-semibold tracking-[-0.08px] text-foreground">{m.selected}</h2>
        <button
          type="button"
          aria-label={m.closePanel}
          onClick={onClose}
          className="flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon name="img-x" size={16} />
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={image.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex flex-col gap-[14px]"
        >
          <Image
            src={image.url}
            alt={image.prompt}
            width={image.width}
            height={image.height}
            unoptimized
            className={cn(
              "h-auto w-full rounded-[18px]",
              image.kind === "BG_REMOVED" && "bg-[repeating-conic-gradient(var(--accent)_0_25%,transparent_0_50%)] bg-[length:16px_16px]",
            )}
          />
          <p className="text-[12.5px] leading-[18px] text-muted-foreground">{image.prompt}</p>
        </motion.div>
      </AnimatePresence>
      <div className="grid grid-cols-2 gap-2">
        {canRemoveBg && (
          <button type="button" disabled={busy || image.kind === "BG_REMOVED"} onClick={onRemoveBg} className={actionClass}>
            <Icon name="img-eraser" size={15} />
            {m.removeBg}
          </button>
        )}
        {canGenerate && (
          <button type="button" disabled={busy || image.kind === "BG_REMOVED"} onClick={onVariations} className={actionClass}>
            <Icon name="img-layers" size={15} />
            {m.variations}
          </button>
        )}
        <a href={image.url} download={`lumen-${image.id}.png`} className={actionClass}>
          <Icon name="img-download" size={15} />
          {m.download}
        </a>
        <button type="button" disabled={busy} onClick={onDelete} className={actionClass}>
          <Icon name="img-x" size={15} />
          {msgs.live.deleteImage}
        </button>
      </div>
    </div>
  );
}
