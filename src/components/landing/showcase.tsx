"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Icon } from "@/components/icon";
import { usePageVisible } from "@/lib/performance";
import { cn } from "@/lib/utils";
import type { LandingPreview, LandingShowcase, ShowcaseScene } from "@/types/landing";
import { EASE, Glow } from "./motion";
import { TiltOnPointer } from "./pointer-effects";
import { PreviewFrame } from "./preview-frame";
import { SceneView, miniGlass, sceneDurations } from "./showcase-scenes";

/** Window (camera viewport) size inside the 1200×780 preview canvas. */
const CW = 1180;
const CH = 748;
/** How long a finished scene stays on screen before the next one plays. */
const HOLD_MS = 3200;
const REDUCED_SCENE_MS = 4200;
/** Px kept free for nav + tabs + caption so the window fits the screen. */
const RESERVE = 300;

type Shot = [target: string | null, zoom: number];
/** Camera per step: zoom onto the element being typed/clicked/answered. */
const OPENING: Shot[] = [
  ["composer", 1.75],
  ["send", 1.95],
  ["thread", 1.35],
];
const FOCUS: Record<ShowcaseScene["id"], Shot[]> = {
  chat: [...OPENING, ["c-intro", 1.55], ["c-bullets", 1.55], ["c-code", 1.5], [null, 1]],
  learn: [...OPENING, ["l-path", 1.6], ["l-quiz", 1.45], ["l-option", 1.75], [null, 1]],
  image: [...OPENING, ["i-prompt", 1.6], ["i-approve", 2], ["i-grid", 1.45], [null, 1]],
  docs: [...OPENING, ["d-files", 1.7], ["d-answer", 1.6], ["d-viewer", 1.35], ["d-highlight", 1.65], [null, 1]],
};
type Aim = [target: string, mode: "click" | "hover" | "block"];
/** Demo pointer per step (it carries the caption). Missing = stays put. */
const OPEN_AIM: Record<number, Aim> = { 0: ["send", "hover"], 1: ["send", "click"], 2: ["thread", "block"] };
const CURSOR: Record<ShowcaseScene["id"], Record<number, Aim>> = {
  chat: { ...OPEN_AIM, 3: ["c-intro", "block"], 4: ["c-bullets", "block"], 5: ["c-code", "block"] },
  learn: { ...OPEN_AIM, 3: ["l-path", "block"], 4: ["l-option", "hover"], 5: ["l-option", "click"] },
  image: { ...OPEN_AIM, 3: ["i-approve", "hover"], 4: ["i-approve", "click"], 5: ["i-grid", "block"] },
  docs: { ...OPEN_AIM, 3: ["d-files", "block"], 4: ["d-answer", "block"], 5: ["d-viewer", "block"], 6: ["d-highlight", "block"] },
};

/** Gentle ease-in-out for every camera and pointer move. */
const CAMERA_EASE = [0.45, 0, 0.2, 1] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Box of `[data-focus=name]` in the camera layer's own (unzoomed) px. */
function measure(layer: HTMLElement, scene: string, name: string) {
  const el = layer.querySelector(`[data-scene="${scene}"] [data-focus="${name}"]`);
  if (!el) return null;
  const L = layer.getBoundingClientRect();
  const k = L.width / CW;
  const r = el.getBoundingClientRect();
  const left = (r.left - L.left) / k;
  const top = (r.top - L.top) / k;
  return { left, top, width: r.width / k, height: r.height / k };
}

function locate(layer: HTMLElement, scene: string, name: string) {
  const b = measure(layer, scene, name);
  return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

/**
 * Product demo under the hero. Plays by itself: each workspace (chat →
 * learning path → image → documents) types its prompt, sends it and gets the
 * answer back while a camera zooms onto whatever is happening, then moves on.
 */
export function Showcase({ preview, showcase }: { preview: LandingPreview; showcase: LandingShowcase }) {
  const frame = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const n = showcase.scenes.length;
  const [{ active, step }, setState] = useState({ active: 0, step: 0 });
  const scene = showcase.scenes[active];
  const durations = useMemo(() => sceneDurations(scene), [scene]);
  const reduce = useReducedMotion() ?? false;
  const onScreen = useInView(frame, { amount: 0.3 });
  const pageVisible = usePageVisible();
  const running = onScreen && pageVisible;
  const shown = reduce ? durations.length : step;
  // Only three captions per scene: asking → answering → finished.
  const captionText = shown < 3 ? showcase.opening : shown < durations.length ? scene.beats[0] : scene.beats[1];

  // Timeline: step through the scene, hold, then the next scene.
  useEffect(() => {
    if (!running) return;
    const done = reduce || step >= durations.length;
    const ms = reduce ? REDUCED_SCENE_MS : done ? HOLD_MS : durations[step];
    const t = setTimeout(
      () => setState((s) => (done ? { active: (s.active + 1) % n, step: 0 } : { active: s.active, step: s.step + 1 })),
      ms,
    );
    return () => clearTimeout(t);
  }, [active, step, running, reduce, durations, n]);

  return (
    <section aria-label={showcase.railLabel} className="relative flex flex-col gap-4 pb-4 sm:gap-5">
      <Rail
        showcase={showcase}
        active={active}
        step={shown}
        durations={durations}
        onPick={(i) => setState({ active: i, step: 0 })}
      />

      <div className="relative mx-auto h-[92px] w-full max-w-[720px] px-4 text-center sm:h-[78px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="flex flex-col gap-1.5"
          >
            <h2 className="text-[19px] leading-[26px] font-semibold tracking-[-0.3px] text-foreground sm:text-[24px] sm:leading-[30px]">
              {scene.title}
            </h2>
            <p className="line-clamp-2 text-[14px] leading-[21px] text-muted-foreground sm:text-[15.5px] sm:leading-[23px]">
              {scene.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div ref={frame} className="px-4 sm:px-8 xl:px-0">
        <TiltOnPointer max={2.5}>
          <PreviewFrame reserveHeight={RESERVE}>
            <div className="absolute top-2.5 left-2.5 h-[748px] w-[1180px] overflow-hidden rounded-[34px] shadow-device">
              <Camera
                layer={layer}
                scene={scene}
                step={shown}
                reduce={reduce}
                caption={captionText}
              >
                <Window preview={preview} showcase={showcase} active={active} step={shown} />
              </Camera>
            </div>
            <AnimatePresence initial={false}>
              <motion.span
                key={scene.id}
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.3, ease: EASE, delay: 0.25 }}
                className={cn(
                  "glass absolute flex items-center gap-1.5 rounded-full px-4 py-[11px] text-[13px] leading-[normal] font-medium whitespace-nowrap text-foreground",
                  active % 2 === 0 ? "top-[566px] left-[-40px]" : "top-[650px] right-[-30px]",
                )}
              >
                <Icon name={scene.chip.icon} size={14} />
                {scene.chip.label}
              </motion.span>
            </AnimatePresence>
          </PreviewFrame>
        </TiltOnPointer>
        <StepCaption text={captionText} />
      </div>
    </section>
  );
}

/** Zooms/pans its content (transform only) and drives the fake pointer. */
function Camera({
  layer,
  scene,
  step,
  reduce,
  caption,
  children,
}: {
  layer: RefObject<HTMLDivElement | null>;
  scene: ShowcaseScene;
  step: number;
  reduce: boolean;
  caption: string;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  // Pointer in window px (outside the zoom, so it never grows with it).
  const cx = useMotionValue(CW * 0.78);
  const cy = useMotionValue(CH * 0.8);
  const cOpacity = useMotionValue(0);
  const cScale = useMotionValue(1);
  const labelX = useMotionValue("0%");
  const labelY = useMotionValue("0%");
  // Where the pointer rests on the page content (unzoomed px) between moves.
  const rest = useRef({ x: CW * 0.78, y: CH * 0.8 });

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const shots = FOCUS[scene.id];
    const [target, zoom] = reduce ? [null, 1] : (shots[Math.min(step, shots.length - 1)] ?? [null, 1]);
    const at = target ? locate(el, scene.id, target) : null;
    const s = at ? zoom : 1;
    const tx = at ? clamp(CW / 2 - at.x * s, CW - CW * s, 0) : 0;
    const ty = at ? clamp(CH / 2 - at.y * s, CH - CH * s, 0) : 0;
    // Slow, smooth ease-in-out "camera move".
    const t = { duration: 1.9, ease: CAMERA_EASE };
    const anims = [animate(x, tx, t), animate(y, ty, t), animate(scale, s, t)];

    if (reduce) {
      anims.push(animate(cOpacity, 0, { duration: 0.2 }));
      return () => anims.forEach((a) => a.stop());
    }

    const glide = (px: number, py: number, duration: number) => {
      rest.current = { x: px, y: py };
      const sx = clamp(px * s + tx, 16, CW - 16);
      const sy = clamp(py * s + ty, 16, CH - 16);
      // Caption flips to whichever side has room.
      anims.push(
        animate(cOpacity, 1, { duration: 0.6 }),
        animate(cx, sx, { duration, ease: CAMERA_EASE }),
        animate(cy, sy, { duration, ease: CAMERA_EASE }),
        animate(labelX, sx > CW * 0.6 ? "-100%" : "0%", { duration: 1.4, ease: CAMERA_EASE }),
        animate(labelY, sy > CH * 0.72 ? "-100%" : "0%", { duration: 1.4, ease: CAMERA_EASE }),
      );
    };

    const aimAt = CURSOR[scene.id][step];
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (aimAt) {
      const [name, mode] = aimAt;
      const go = () => {
        const b = measure(el, scene.id, name);
        if (!b) return;
        // Buttons: point at the centre. Blocks: rest just under the new
        // content's left edge, where the next part hasn't appeared yet.
        const px = mode === "block" ? b.left + Math.min(56, b.width / 3) : b.left + b.width / 2;
        const py = mode === "block" ? b.top + b.height + 6 : b.top + b.height / 2;
        glide(px, py, mode === "click" ? 0.9 : 1.8);
        if (mode === "click") anims.push(animate(cScale, [1, 0.8, 1], { duration: 0.5, delay: 0.25, ease: "easeInOut" }));
      };
      if (mode === "click") go();
      else timer = setTimeout(go, 400);
    } else {
      // No new target: stay on the same spot while the camera moves.
      glide(rest.current.x, rest.current.y, 1.9);
    }
    return () => {
      clearTimeout(timer);
      anims.forEach((a) => a.stop());
    };
  }, [layer, scene.id, step, reduce, x, y, scale, cx, cy, cOpacity, cScale, labelX, labelY]);

  return (
    <>
      <motion.div ref={layer} className="absolute inset-0" style={{ x, y, scale, originX: 0, originY: 0 }}>
        {children}
      </motion.div>

      {/* Demo pointer with the step caption riding along. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-20"
        style={{ x: cx, y: cy, opacity: cOpacity }}
      >
        <motion.svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          className="absolute top-[-4px] left-[-7px] drop-shadow-[0_3px_6px_rgb(0_0_0/0.45)]"
          style={{ scale: cScale }}
        >
          <path d="M5 3l14 8-6 1.6L10 19z" fill="white" stroke="black" strokeWidth="1.3" strokeLinejoin="round" />
        </motion.svg>
        <motion.div className="absolute top-0 left-0 hidden p-[24px] sm:block" style={{ x: labelX, y: labelY }}>
          <AnimatePresence mode="wait" initial={false}>
            <CaptionPill key={caption} text={caption} large />
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}

/** On phones the window is too small for the pointer caption, so it sits below. */
function StepCaption({ text }: { text: string }) {
  return (
    <div className="mt-4 flex h-[44px] justify-center sm:hidden" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <CaptionPill key={text} text={text} />
      </AnimatePresence>
    </div>
  );
}

function CaptionPill({
  text,
  large,
}: {
  text: string;
  /** Inside the scaled preview canvas: bigger type so it reads at ~0.7×. */
  large?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className={cn(
        "glass flex w-max items-center rounded-full shadow-device",
        large ? "gap-3 py-[11px] pr-5 pl-4" : "max-w-[calc(100vw-32px)] gap-2.5 py-2 pr-4 pl-3",
      )}
    >
      <span className={cn("rounded-full bg-brand-orange", large ? "size-[9px]" : "size-2")} />
      <span
        className={cn(
          "leading-[normal] font-medium whitespace-nowrap text-foreground",
          large ? "text-[19px]" : "truncate text-[13.5px]",
        )}
      >
        {text}
      </span>
    </motion.div>
  );
}

function Rail({
  showcase,
  active,
  step,
  durations,
  onPick,
}: {
  showcase: LandingShowcase;
  active: number;
  step: number;
  durations: number[];
  onPick: (i: number) => void;
}) {
  // Progress bar glides toward the end of the current step.
  const total = durations.length + 1;
  const target = Math.min(1, (step + 1) / total);
  const ms = durations[step] ?? HOLD_MS;
  return (
    <div className="sticky top-[78px] z-30 flex justify-center px-4 sm:top-[98px]">
      <div
        role="tablist"
        aria-label={showcase.railLabel}
        className="glass flex max-w-full gap-[2px] overflow-x-auto rounded-full p-1 [scrollbar-width:none]"
      >
        {showcase.scenes.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onPick(i)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-3 py-2 text-[12.5px] leading-[normal] font-medium whitespace-nowrap transition-colors sm:px-4 sm:text-[13.5px]",
                selected ? "bg-surface-raised text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon name={s.icon} size={14} className="relative" />
              <span className="relative">{s.label}</span>
              {selected && (
                <motion.span
                  key={`${s.id}-bar`}
                  aria-hidden
                  className="bg-brand-gradient absolute inset-x-3 bottom-[3px] h-[2px] origin-left rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: target }}
                  transition={{ duration: ms / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Window({
  preview: p,
  showcase,
  active,
  step,
}: {
  preview: LandingPreview;
  showcase: LandingShowcase;
  active: number;
  step: number;
}) {
  const scene = showcase.scenes[active];
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[34px] border-[1.2px] border-border-glass bg-[linear-gradient(148deg,var(--glass-from),var(--glass-to)_83%)]">
      <div className="bg-window absolute top-[12.8px] left-[12.8px] h-[720px] w-[1152px] overflow-hidden rounded-[19.2px]">
        <Glow tone="blue" blur={96} drift={20} className="top-[528px] left-[-112px] size-[272px]" />
        <Glow tone="orange" blur={88} drift={20} duration={22} className="top-[-80px] left-[960px] size-[240px]" />

        <Sidebar p={p} nav={scene.nav} recent={scene.recent} model={scene.model} modelDetail={scene.modelDetail} />

        <div className="absolute top-5 left-[246.4px] flex items-center gap-1 rounded-[9.6px] px-2 py-[4.8px] text-foreground">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={scene.model}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              className="text-[12px] font-semibold"
            >
              {scene.model}
            </motion.span>
          </AnimatePresence>
          <Icon name="chev" size={11.2} className="text-icon" />
        </div>

        <div className={cn(miniGlass, "absolute top-[14.4px] left-[562.4px] flex gap-[1.6px] rounded-[12.8px] p-[3.2px]")}>
          {p.tabs.map((t, i) => {
            const on = i === scene.tab;
            return (
              <span
                key={t.label}
                className={cn(
                  "flex items-center gap-[5.6px] rounded-[9.6px] px-[12.8px] py-[7.2px] text-[10.8px] font-medium transition-[background-color,color,box-shadow] duration-300",
                  on ? "bg-surface-raised text-foreground shadow-soft" : "text-muted-foreground",
                )}
              >
                <Icon name={t.icon} size={12} className={on ? "text-foreground" : "text-icon"} />
                {t.label}
              </span>
            );
          })}
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={scene.id}
            data-scene={scene.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute inset-0"
          >
            <SceneView scene={scene} preview={p} showcase={showcase} step={step} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Sidebar({
  p,
  nav,
  recent,
  model,
  modelDetail,
}: {
  p: LandingPreview;
  nav: number;
  recent: string;
  model: string;
  modelDetail: string;
}) {
  return (
    <div
      className={cn(
        miniGlass,
        "absolute top-[12.8px] left-[12.8px] flex h-[694.4px] w-[217.6px] flex-col gap-[1.6px] rounded-[22.4px] px-[9.6px] pt-[12.8px] pb-[11.2px]",
      )}
    >
      <div className="flex items-center justify-between pb-[9.6px] pl-[6.4px]">
        <div className="flex items-center gap-[5.6px]">
          <Icon name="spark" size={14.4} className="text-foreground" />
          <span className="text-[13.6px] font-semibold tracking-[-0.136px] text-foreground">Lumen</span>
        </div>
        <span className="flex size-6 items-center justify-center text-icon">
          <Icon name="panel" size={13.6} />
        </span>
      </div>

      {p.nav.map((n, i) => (
        <div
          key={n.label}
          className={cn(
            "flex h-8 items-center gap-[9.6px] rounded-[9.6px] pr-[6.4px] pl-2 text-foreground transition-colors duration-300",
            i === nav && "bg-nav-active/60 dark:bg-foreground/30",
          )}
        >
          <Icon name={n.icon} size={15.2} className="mx-[0.4px]" />
          <span className="flex-1 truncate text-[11.6px]">{n.label}</span>
          {n.trailing && (
            <span className="flex size-[20.8px] items-center justify-center text-icon">
              <Icon name="plus-sm" size={13.6} />
            </span>
          )}
        </div>
      ))}

      <SectionLabel>{p.sections.pinned}</SectionLabel>
      {p.pinned.map((t) => (
        <HistoryItem key={t} title={t} active={t === recent} />
      ))}
      <SectionLabel>{p.sections.recents}</SectionLabel>
      {p.recents.map((r) => (
        <HistoryItem key={r.title} title={r.title} active={r.title === recent} />
      ))}

      <div className="flex-1" />

      <div className={cn(miniGlass, "flex flex-col gap-[2.4px] rounded-[11.2px] px-[9.6px] py-2")}>
        <div className="flex items-center gap-[5.6px]">
          <span className="size-[6.4px] rounded-full bg-success" />
          <span className="flex-1 truncate text-[10px] font-medium text-foreground">{model}</span>
          <span className="text-[9.2px] text-success-foreground">{p.modelState}</span>
        </div>
        <span className="truncate text-[8.8px] text-muted-foreground">{modelDetail}</span>
      </div>

      <div className="flex items-center gap-2 pt-2 pl-[4.8px]">
        <span className="bg-brand-gradient flex size-[27.2px] items-center justify-center rounded-full text-[9.6px] font-semibold text-white">
          {p.user.initials}
        </span>
        <div className="flex flex-1 flex-col gap-[0.8px] whitespace-nowrap">
          <span className="text-[10.4px] font-medium text-foreground">{p.user.name}</span>
          <span className="text-[8.8px] text-muted-foreground">{p.user.plan}</span>
        </div>
        <span className="flex size-6 items-center justify-center text-icon">
          <Icon name="sliders" size={12.8} />
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-[3.2px] pt-[14.4px] pb-[4.8px] pl-2 text-subtle">
      <span className="text-[10px] font-medium">{children}</span>
      <Icon name="caret" size={8} />
    </div>
  );
}

function HistoryItem({ title, active }: { title: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-[27.2px] items-center rounded-lg px-2 transition-[background-color,box-shadow] duration-300",
        active && "bg-nav-active shadow-[0_1.6px_3.2px_0_rgb(0_0_0/0.08)]",
      )}
    >
      <span className="truncate text-[10.8px] text-foreground-secondary">{title}</span>
    </div>
  );
}
