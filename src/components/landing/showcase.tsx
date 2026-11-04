"use client";

import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { usePageVisible } from "@/lib/performance";
import { cn } from "@/lib/utils";
import type { LandingPreview, LandingShowcase } from "@/types/landing";
import { EASE, Glow } from "./motion";
import { TiltOnPointer } from "./pointer-effects";
import { PreviewFrame } from "./preview-frame";
import { SceneView, miniGlass } from "./showcase-scenes";

/** Px kept free above/below the pinned window: nav + rail + caption + gaps. */
const RESERVE = 316;

/**
 * Product demo under the hero. The app window pins to the screen while the
 * section scrolls past; each quarter of the scroll plays one workspace:
 * chat → learning path → image generation → documents (RAG).
 */
export function Showcase({ preview, showcase }: { preview: LandingPreview; showcase: LandingShowcase }) {
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const n = showcase.scenes.length;
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
    setActive((cur) => (cur === next ? cur : next));
  });

  const onScreen = useInView(frame, { amount: 0.25 });
  const pageVisible = usePageVisible();
  const running = onScreen && pageVisible;
  const scene = showcase.scenes[active];

  const jumpTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (range * (i + 0.08)) / n, behavior: "smooth" });
  };

  return (
    <section ref={track} aria-label={showcase.railLabel} className="relative h-[320vh] sm:h-[400vh]">
      <div className="sticky top-[84px] flex flex-col gap-4 sm:top-[108px] sm:gap-5">
        <Rail showcase={showcase} active={active} progress={scrollYProgress} onPick={jumpTo} />

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
              <Window preview={preview} showcase={showcase} active={active} running={running} />
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
        </div>
      </div>
    </section>
  );
}

function Rail({
  showcase,
  active,
  progress,
  onPick,
}: {
  showcase: LandingShowcase;
  active: number;
  progress: MotionValue<number>;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex justify-center px-4">
      <div
        role="tablist"
        aria-label={showcase.railLabel}
        className="glass flex max-w-full gap-[2px] overflow-x-auto rounded-full p-1 [scrollbar-width:none]"
      >
        {showcase.scenes.map((s, i) => (
          <RailPill
            key={s.id}
            label={s.label}
            icon={s.icon}
            index={i}
            count={showcase.scenes.length}
            selected={i === active}
            progress={progress}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
    </div>
  );
}

function RailPill({
  label,
  icon,
  index,
  count,
  selected,
  progress,
  onClick,
}: {
  label: string;
  icon: string;
  index: number;
  count: number;
  selected: boolean;
  progress: MotionValue<number>;
  onClick: () => void;
}) {
  // How far through this scene the scroll is (0–1), drawn as a thin bar.
  const fill = useTransform(progress, (p) => Math.min(1, Math.max(0, p * count - index)));
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full px-3 py-2 text-[12.5px] leading-[normal] font-medium whitespace-nowrap transition-colors sm:px-4 sm:text-[13.5px]",
        selected ? "bg-surface-raised text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon name={icon} size={14} className="relative" />
      <span className="relative">{label}</span>
      <motion.span
        aria-hidden
        className="bg-brand-gradient absolute inset-x-3 bottom-[3px] h-[2px] origin-left rounded-full"
        style={{ scaleX: fill, opacity: selected ? 1 : 0 }}
      />
    </button>
  );
}

function Window({
  preview: p,
  showcase,
  active,
  running,
}: {
  preview: LandingPreview;
  showcase: LandingShowcase;
  active: number;
  running: boolean;
}) {
  const scene = showcase.scenes[active];
  return (
    <div className="absolute top-2.5 left-2.5 h-[748px] w-[1180px] overflow-hidden rounded-[34px] border-[1.2px] border-border-glass bg-[linear-gradient(148deg,var(--glass-from),var(--glass-to)_83%)] shadow-device">
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
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute inset-0"
          >
            <SceneView scene={scene} preview={p} showcase={showcase} running={running} />
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
