"use client";

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { LandingPreview, LandingShowcase, ShowcaseScene } from "@/types/landing";
import { EASE } from "./motion";
import { graphemes } from "./typewriter";

/** Scaled-down glass (Figma app preview is the app at 0.8×). */
export const miniGlass =
  "border-[0.96px] border-border-glass bg-[linear-gradient(170deg,var(--glass-from),var(--glass-to)_83%)] shadow-soft backdrop-blur-[var(--mini-glass-blur,calc(var(--glass-blur)*0.8))]";

const faviconTone = {
  muted: "bg-muted-foreground",
  teal: "bg-teal",
  yellow: "bg-yellow",
} as const;

const MS_PER_CHAR = 22;
/** Shared opening of every scene: type → click send → user bubble + thinking. Kept quick. */
const SEND_MS = 650;
const THINK_MS = 850;
/** Then each scene reveals its answer in a few beats (ms per beat). */
const BEATS: Record<ShowcaseScene["id"], number[]> = {
  chat: [1900, 2000, 1500],
  learn: [1700, 1900, 1500],
  image: [1900, 1500, 2000],
  docs: [1700, 2000, 1700, 1800],
};
/** Streaming speed of answer text (ms per word/segment). */
const MS_PER_WORD = 34;

/**
 * Durations (ms) of each step of a scene. Steps: 0 type, 1 send, 2 think,
 * 3… answer beats; reaching `length` means the scene has finished.
 */
export function sceneDurations(scene: ShowcaseScene): number[] {
  return [graphemes(scene.prompt).length * MS_PER_CHAR + 350, SEND_MS, THINK_MS, ...BEATS[scene.id]];
}

/** Words, so streamed text reveals like a model writing (Khmer too). */
function words(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(seg.segment(text), (x) => x.segment);
  }
  return text.split(/(\s+)/);
}

/** Answer text streaming in word by word, like a real model response. */
function Stream({ text, delay = 0, perWord = MS_PER_WORD }: { text: string; delay?: number; perWord?: number }) {
  const parts = useMemo(() => words(text), [text]);
  const count = useMotionValue(0);
  const out = useTransform(count, (c) => parts.slice(0, Math.ceil(c)).join(""));
  useEffect(() => {
    const a = animate(count, parts.length, {
      duration: (parts.length * perWord) / 1000,
      delay: delay / 1000,
      ease: "linear",
    });
    return () => a.stop();
  }, [count, parts, perWord, delay]);
  return <motion.span>{out}</motion.span>;
}

/** Text typed in with a motion value (no React re-render per character). */
function Typed({ text, perChar = MS_PER_CHAR }: { text: string; perChar?: number }) {
  const parts = useMemo(() => graphemes(text), [text]);
  const count = useMotionValue(0);
  const out = useTransform(count, (c) => parts.slice(0, Math.round(c)).join(""));
  useEffect(() => {
    const a = animate(count, parts.length, { duration: (parts.length * perChar) / 1000, ease: "linear" });
    return () => a.stop();
  }, [count, parts, perChar]);
  return <motion.span>{out}</motion.span>;
}

/** Fade-rise for each block of the answer as it "streams" in. */
function Beat({
  show,
  children,
  className,
  delay = 0,
  focus,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Camera target name (see FOCUS in showcase.tsx). */
  focus?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE, delay }}
          className={className}
          data-focus={focus}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SceneView({
  scene,
  preview,
  showcase,
  step,
}: {
  scene: ShowcaseScene;
  preview: LandingPreview;
  showcase: LandingShowcase;
  step: number;
}) {
  const reduce = useReducedMotion() ?? false;
  // Beats of the answer: -1 while still sending/thinking.
  const beat = step - 3;
  const docs = scene.id === "docs";

  return (
    <>
      <div className="absolute top-16 left-[243.2px] h-[545.28px] w-[896px] overflow-hidden">
        <div className={cn("absolute top-[9.6px] flex flex-col gap-[16px]", docs ? "left-6 w-[480px]" : "left-40 w-[576px]")}>
          <Beat show={step >= 2} className="flex justify-end" focus="thread">
            <div className="max-w-[440px] rounded-[17.6px] bg-secondary px-[14.4px] py-[8.8px] text-[12px] leading-[17.6px] text-foreground">
              {scene.prompt}
            </div>
          </Beat>

          <AnimatePresence initial={false}>
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                className="flex items-center gap-2 text-subtle"
              >
                <span className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="size-[5px] rounded-full bg-current"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
                <span className="text-[10.4px]">{showcase.thinking}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {scene.id === "chat" && <ChatAnswer p={preview} beat={beat} />}
          {scene.id === "learn" && <LearnAnswer s={showcase} beat={beat} />}
          {scene.id === "image" && <ImageAnswer s={showcase} beat={beat} />}
          {docs && <DocsAnswer s={showcase} beat={beat} />}
        </div>
        {docs && <DocViewer s={showcase} beat={beat} />}
      </div>

      <Composer
        p={preview}
        prompt={scene.prompt}
        step={step}
        reduce={reduce}
        chip={docs ? { icon: "doc-book-sm", label: showcase.docs.usingLabel } : { icon: "globe", label: preview.search }}
      />
    </>
  );
}

function Composer({
  p,
  prompt,
  step,
  reduce,
  chip,
}: {
  p: LandingPreview;
  prompt: string;
  step: number;
  reduce: boolean;
  chip: { icon: string; label: string };
}) {
  return (
    <>
      <div
        className={cn(
          miniGlass,
          "absolute top-[618.88px] left-[395.2px] flex w-[592px] flex-col gap-2 rounded-[22.4px] py-[11.2px] pr-[9.6px] pl-[12.8px]",
        )}
        data-focus="composer"
      >
        <span className="h-[15px] truncate text-[12.4px] leading-[15px] whitespace-nowrap text-foreground">
          {step >= 2 ? (
            <span className="text-subtle">{p.composerPlaceholder}</span>
          ) : step === 1 || reduce ? (
            prompt
          ) : (
            <>
              <Typed text={prompt} />
              <motion.span
                aria-hidden
                className="ml-px inline-block h-[1em] w-[1.6px] translate-y-[0.12em] rounded-full bg-brand-blue-strong"
                animate={{ opacity: [1, 1, 0, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
              />
            </>
          )}
        </span>
        <div className="flex items-center gap-[4.8px]">
          <span className="flex size-[27.2px] items-center justify-center text-icon">
            <Icon name="plus" size={14.4} />
          </span>
          <span className="bg-primary-fill flex items-center gap-[4.8px] rounded-full px-[9.6px] py-[5.6px] text-[10px] font-medium">
            <Icon name={chip.icon} size={11.2} />
            {chip.label}
          </span>
          <span className="flex-1" />
          <span className="flex size-[27.2px] items-center justify-center text-icon">
            <Icon name="mic" size={13.6} />
          </span>
          <motion.span
            data-focus="send"
            className="bg-primary-fill relative flex size-[28.8px] items-center justify-center rounded-full"
            animate={step === 1 ? { scale: [1, 0.82, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.26 }}
          >
            {step === 1 && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full ring-2 ring-brand-blue"
                initial={{ opacity: 0.8, scale: 1 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.4 }}
              />
            )}
            <Icon name="up" size={13.6} />
          </motion.span>
        </div>
      </div>
      <p className="absolute top-[700px] left-[395.2px] w-[592px] text-center text-[9.2px] text-subtle">{p.disclaimer}</p>
    </>
  );
}

/** Source names cited in the chat answer, in order. */
function sourceNames(m: LandingPreview["message"]): string[] {
  const names = [m.intro.source, ...m.bullets.map((b) => b.source).filter((x): x is string => !!x)];
  return Array.from(new Set(names));
}

/* ── Chat ─────────────────────────────────────────────────────────────── */

function Cite({ children }: { children: string }) {
  return <span className="text-[9.6px] font-medium text-subtle">{children}</span>;
}

function ChatAnswer({ p, beat }: { p: LandingPreview; beat: number }) {
  const m = p.message;
  return (
    <div className="flex flex-col items-start gap-[11.2px] text-foreground">
      <Beat show={beat >= 0} className="flex flex-col gap-[11.2px]" focus="c-intro">
        <div className="flex items-center gap-[4.8px] text-subtle">
          <Icon name="globe" size={11.2} />
          <span className="text-[10.4px]">{m.searchTrace}</span>
        </div>
        {/* Sources found first, then the answer streams in. */}
        <div className="flex flex-wrap gap-[6px]">
          {sourceNames(m).map((name, i) => (
            <motion.span
              key={name}
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE, delay: 0.1 + i * 0.14 }}
              className={cn(miniGlass, "flex items-center gap-[5px] rounded-full py-[3.5px] pr-[9px] pl-[4px] text-[9.6px] font-medium")}
            >
              <span
                className={cn(
                  "flex size-[13px] items-center justify-center rounded-full text-[6.8px] font-bold text-white",
                  faviconTone[m.sources[i % m.sources.length].tone],
                )}
              >
                {name[0]}
              </span>
              {name}
            </motion.span>
          ))}
        </div>
        <p className="text-[12.4px] leading-[20.8px]">
          <Stream text={m.intro.text} delay={650} />{" "}
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
            <Cite>{m.intro.source}</Cite>
          </motion.span>
        </p>
      </Beat>
      {beat >= 1 && (
        <ul data-focus="c-bullets" className="list-disc pl-[18.6px] text-[12.4px] leading-[20.8px]">
          {m.bullets.map((b, i) => (
            <motion.li
              key={b.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, ease: EASE, delay: i * 0.52 }}
            >
              <span className="font-semibold">{b.title}</span> <Stream text={b.text} delay={i * 520} perWord={30} />
              {b.source && (
                <>
                  {" "}
                  <Cite>{b.source}</Cite>
                </>
              )}
            </motion.li>
          ))}
        </ul>
      )}
      <Beat show={beat >= 2} className="w-full" focus="c-code">
        <div className="flex w-full flex-col rounded-[11.2px] border-[0.8px] border-foreground/6 bg-foreground/5">
          <div className="flex items-center justify-between px-[9.6px] py-[5.6px] text-muted-foreground">
            <span className="text-[9.6px]">{m.code.label}</span>
            <Icon name="landing-copy" size={11.2} className="text-icon" />
          </div>
          <div className="px-[12.8px] py-[9.6px] font-mono text-[10.8px] leading-[17.6px]">{m.code.content}</div>
        </div>
      </Beat>
      <Beat show={beat >= 3} className="flex flex-col items-start gap-[11.2px]">
        <p className="text-[12.4px] leading-[20.8px]">
          <Stream text={m.followUp} />
        </p>
        <div className={cn(miniGlass, "flex items-center gap-[6.4px] rounded-full py-[4.8px] pr-[9.6px] pl-[6.4px]")}>
          <div className="flex">
            {m.sources.map((s, i) => (
              <span
                key={s.letter}
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border-[1.6px] border-card text-[7.2px] font-bold text-white",
                  faviconTone[s.tone],
                  i < m.sources.length - 1 && "-mr-1",
                )}
              >
                {s.letter}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-medium">{m.sourcesLabel}</span>
        </div>
        <div className="flex items-center gap-[1.6px] text-icon">
          {["landing-copy", "landing-tup", "landing-tdown", "landing-refresh", "landing-lang"].map((i) => (
            <span key={i} className="flex size-6 items-center justify-center">
              <Icon name={i} size={12} />
            </span>
          ))}
        </div>
      </Beat>
    </div>
  );
}

/* ── Learning path ────────────────────────────────────────────────────── */

function LearnAnswer({ s, beat }: { s: LandingShowcase; beat: number }) {
  const l = s.learn;
  const picked = beat >= 2;
  const passed = beat >= 3;
  return (
    <div className="flex flex-col gap-[12px] text-foreground">
      <Beat show={beat >= 0} focus="l-path">
        <div className={cn(miniGlass, "flex flex-col gap-[10px] rounded-[16px] px-[14px] py-[12px]")}>
          <div className="flex items-center gap-2">
            <span className="bg-brand-gradient flex size-[26px] items-center justify-center rounded-[8px] text-white">
              <Icon name="nav-cap" size={13} />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-[12.4px] font-semibold">{l.path}</span>
              <span className="text-[9.6px] text-muted-foreground">{l.stepOf}</span>
            </div>
            <AnimatePresence>
              {passed && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: EASE, delay: 0.25 }}
                  className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-[3px] text-[9.6px] font-medium text-success-foreground"
                >
                  <Icon name="learn-check" size={10} />
                  {l.unlocked}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="grid grid-cols-5 gap-[6px]">
            {l.steps.map((step, i) => {
              const done = i < l.current || (passed && i === l.current);
              const current = passed ? i === l.current + 1 : i === l.current;
              return (
                <div key={step} className="flex min-w-0 flex-col gap-[5px]">
                  <span className="relative h-[4px] overflow-hidden rounded-full bg-foreground/10">
                    <motion.span
                      className="bg-brand-gradient absolute inset-0 origin-left rounded-full"
                      initial={false}
                      animate={{ scaleX: done ? 1 : current ? 0.35 : 0 }}
                      transition={{ duration: 0.5, ease: EASE, delay: done && passed ? 0.1 : 0 }}
                    />
                  </span>
                  <span
                    className={cn(
                      "truncate text-[9.2px] transition-colors",
                      current ? "font-semibold text-foreground" : done ? "text-foreground-secondary" : "text-subtle",
                    )}
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Beat>

      <Beat show={beat >= 1} focus="l-quiz">
        <div className={cn(miniGlass, "flex flex-col gap-[10px] rounded-[16px] px-[14px] py-[13px]")}>
          <span className="text-[9.6px] font-semibold tracking-[0.4px] text-brand-blue-strong uppercase">{l.quizLabel}</span>
          <p className="font-mono text-[11.2px] leading-[17px]">
            <Stream text={l.question} perWord={26} />
          </p>
          <div className="flex flex-col gap-[6px]">
            {l.options.map((o, i) => {
              const isCorrect = i === l.correct;
              const chosen = picked && isCorrect;
              return (
                <motion.div
                  key={o}
                  data-focus={isCorrect ? "l-option" : undefined}
                  animate={chosen && !passed ? { scale: [1, 0.98, 1] } : { scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "flex items-center gap-2 rounded-[10px] border-[0.8px] px-[10px] py-[7px] text-[11.2px] transition-colors duration-300",
                    passed && isCorrect
                      ? "border-success/50 bg-success/12 text-foreground"
                      : chosen
                        ? "border-brand-blue/60 bg-brand-blue/10"
                        : "border-foreground/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[14px] items-center justify-center rounded-full border-[1.2px] transition-colors duration-300",
                      passed && isCorrect ? "border-success bg-success text-white" : chosen ? "border-brand-blue" : "border-foreground/25",
                    )}
                  >
                    {passed && isCorrect && <Icon name="learn-check" size={8} />}
                  </span>
                  {o}
                </motion.div>
              );
            })}
          </div>
          <Beat show={passed}>
            <p className="text-[11px] font-medium text-success-foreground">{l.correctLabel}</p>
          </Beat>
        </div>
      </Beat>
    </div>
  );
}

/* ── Image generation ─────────────────────────────────────────────────── */

function Percent({ ms }: { ms: number }) {
  const v = useMotionValue(0);
  const text = useTransform(v, (n) => `${Math.round(n)}%`);
  useEffect(() => {
    const a = animate(v, 100, { duration: ms / 1000, ease: [0.3, 0.6, 0.4, 1] });
    return () => a.stop();
  }, [v, ms]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

function ImageAnswer({ s, beat }: { s: LandingShowcase; beat: number }) {
  const im = s.image;
  const approved = beat >= 1;
  const generating = beat === 2;
  const done = beat >= 3;
  return (
    <div className="flex flex-col gap-[12px] text-foreground">
      <Beat show={beat >= 0} focus="i-prompt">
        <div className={cn(miniGlass, "flex flex-col gap-[9px] rounded-[16px] px-[14px] py-[12px]")}>
          <div className="flex items-center gap-[6px] text-brand-blue-strong">
            <Icon name="img-sparkles" size={12} />
            <span className="text-[9.6px] font-semibold tracking-[0.4px] uppercase">{im.improvedLabel}</span>
          </div>
          <p className="min-h-[36px] text-[11.6px] leading-[18px] text-foreground-secondary">
            <Stream text={im.improvedPrompt} delay={200} perWord={28} />
          </p>
          <div className="flex items-center gap-[6px]">
            <motion.span
              data-focus="i-approve"
              animate={approved && !done ? { scale: [1, 0.9, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.26 }}
              className={cn(
                "bg-primary-fill flex items-center gap-1 rounded-full px-[12px] py-[6px] text-[10.4px] font-medium transition-opacity",
                approved && "opacity-60",
              )}
            >
              <Icon name="img-check" size={11} />
              {im.approve}
            </motion.span>
            <span className="rounded-full px-[10px] py-[6px] text-[10.4px] text-muted-foreground">{im.edit}</span>
          </div>
        </div>
      </Beat>

      <Beat show={approved} className="flex flex-col gap-[8px]">
        <div className="flex items-center gap-[6px] text-[10.4px] text-subtle">
          <Icon name="img-images" size={11.2} />
          {done ? im.doneLabel : (
            <span>
              {im.generating} · {generating ? <Percent ms={BEATS.image[2]} /> : "0%"}
            </span>
          )}
        </div>
        <div data-focus="i-grid" className="grid grid-cols-4 gap-[10px]">
          {im.images.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-[12px] bg-foreground/6">
              {!done && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(100deg,transparent_20%,var(--glass-from)_50%,transparent_80%)] opacity-70"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: i * 0.12 }}
                />
              )}
              {done && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.45, ease: EASE, delay: i * 0.09 }}
                >
                  <Image src={src} alt="" fill sizes="140px" className="object-cover" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </Beat>
    </div>
  );
}

/* ── Documents (RAG) ──────────────────────────────────────────────────── */

function DocsAnswer({ s, beat }: { s: LandingShowcase; beat: number }) {
  const d = s.docs;
  return (
    <div className="flex flex-col items-start gap-[11px] text-foreground">
      <Beat show={beat >= 0} className="flex flex-col gap-[8px]" focus="d-files">
        <div className="flex items-center gap-[4.8px] text-subtle">
          <Icon name="doc-book-sm" size={11.2} />
          <span className="text-[10.4px]">{d.searching}</span>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {d.files.map((f, i) => (
            <motion.span
              key={f}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE, delay: i * 0.1 }}
              className={cn(miniGlass, "flex items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[9.6px] font-medium")}
            >
              <Icon name="doc-file-sm" size={10} className="text-icon" />
              {f}
            </motion.span>
          ))}
        </div>
      </Beat>
      <Beat show={beat >= 1} className="flex flex-col items-start gap-[8px]" focus="d-answer">
        <p className="text-[12.4px] leading-[20.8px]">
          <Stream text={d.answer} />
        </p>
        <span className="flex items-center gap-[5px] rounded-full bg-brand-orange/14 px-[9px] py-[4px] text-[9.6px] font-medium text-foreground">
          <Icon name="doc-file-sm" size={10} />
          {d.citation}
        </span>
      </Beat>
    </div>
  );
}

function DocViewer({ s, beat }: { s: LandingShowcase; beat: number }) {
  const d = s.docs;
  const lit = beat >= 3;
  return (
    <AnimatePresence initial={false}>
      {beat >= 2 && (
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          data-focus="d-viewer"
          className={cn(miniGlass, "absolute top-[8px] left-[528px] flex h-[528px] w-[352px] flex-col rounded-[18px]")}
        >
          <div className="flex items-center gap-2 border-b-[0.8px] border-foreground/8 px-[14px] py-[11px]">
            <span className="flex size-[24px] items-center justify-center rounded-[7px] bg-brand-orange/15 text-brand-orange">
              <Icon name="doc-file-sm" size={12} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[11.2px] font-semibold text-foreground">{d.fileName}</span>
              <span className="text-[9.2px] text-muted-foreground">{d.fileMeta}</span>
            </div>
            <Icon name="doc-x" size={12} className="text-icon" />
          </div>
          <div className="flex flex-col gap-[10px] px-[18px] py-[16px] text-foreground">
            <span className="text-[13px] font-semibold">{d.heading}</span>
            <p className="text-[11.2px] leading-[19px] text-foreground-secondary">
              {d.before}
              <span
                data-focus="d-highlight"
                className={cn(
                  "rounded-[3px] box-decoration-clone px-[2px] transition-colors duration-500",
                  lit ? "bg-brand-orange/25 text-foreground" : "bg-transparent",
                )}
              >
                {d.highlight}
              </span>
              {d.after}
            </p>
            {[92, 100, 84, 96, 70].map((w, i) => (
              <span key={i} className="h-[7px] rounded-full bg-foreground/7" style={{ width: `${w}%` }} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
