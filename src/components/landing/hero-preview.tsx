import { Icon } from "@/components/icon";
import { TypewriterLoop } from "./typewriter";
import { cn } from "@/lib/utils";
import type { LandingPreview } from "@/types/landing";
import { Glow } from "./motion";
import { PreviewFrame } from "./preview-frame";

/** Scaled-down glass (Figma app preview is the app at 0.8×). */
const miniGlass =
  "border-[0.96px] border-border-glass bg-[linear-gradient(170deg,var(--glass-from),var(--glass-to)_83%)] shadow-soft backdrop-blur-[calc(var(--glass-blur)*0.8)]";

const faviconTone = {
  muted: "bg-muted-foreground",
  teal: "bg-teal",
  yellow: "bg-yellow",
} as const;

function Sidebar({ p }: { p: LandingPreview }) {
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

      {p.nav.map((n) => (
        <div
          key={n.label}
          className={cn(
            "flex h-8 items-center gap-[9.6px] rounded-[9.6px] pr-[6.4px] pl-2 text-foreground",
            n.active && "bg-nav-active/60 dark:bg-foreground/30",
          )}
        >
          <Icon name={n.icon} size={15.2} className="mx-[0.4px]" />
          <span className="flex-1 text-[11.6px]">{n.label}</span>
          {n.trailing && (
            <span className="flex size-[20.8px] items-center justify-center text-icon">
              <Icon name="plus-sm" size={13.6} />
            </span>
          )}
        </div>
      ))}

      <SectionLabel>Pinned</SectionLabel>
      {p.pinned.map((t) => (
        <HistoryItem key={t} title={t} />
      ))}
      <SectionLabel>Recents</SectionLabel>
      {p.recents.map((r) => (
        <HistoryItem key={r.title} title={r.title} active={r.active} />
      ))}

      <div className="flex-1" />

      <div className={cn(miniGlass, "flex flex-col gap-[2.4px] rounded-[11.2px] px-[9.6px] py-2")}>
        <div className="flex items-center gap-[5.6px]">
          <span className="size-[6.4px] rounded-full bg-success" />
          <span className="flex-1 text-[10px] font-medium text-foreground">{p.model}</span>
          <span className="text-[9.2px] text-success-foreground">{p.modelState}</span>
        </div>
        <span className="text-[8.8px] text-muted-foreground">{p.modelDetail}</span>
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
        "flex h-[27.2px] items-center rounded-lg px-2",
        active && "bg-nav-active shadow-[0_1.6px_3.2px_0_rgb(0_0_0/0.08)]",
      )}
    >
      <span className="truncate text-[10.8px] text-foreground-secondary">{title}</span>
    </div>
  );
}

function Thread({ p }: { p: LandingPreview }) {
  const m = p.message;
  return (
    <div className="absolute top-16 left-[243.2px] h-[545.28px] w-[896px] overflow-hidden">
      <div className="absolute top-[9.6px] left-40 flex w-[576px] flex-col gap-[22.4px]">
        <div className="flex justify-end">
          <div className="rounded-[17.6px] bg-secondary px-[14.4px] py-[8.8px] text-[12px] leading-[17.6px] text-foreground">
            {m.question}
          </div>
        </div>

        <div className="flex flex-col items-start gap-[11.2px] text-foreground">
          <div className="flex items-center gap-[4.8px] text-subtle">
            <Icon name="globe" size={11.2} />
            <span className="text-[10.4px]">{m.searchTrace}</span>
          </div>
          <p className="text-[12.4px] leading-[20.8px]">
            {m.intro.text} <Cite>{m.intro.source}</Cite>
          </p>
          <ul className="list-disc pl-[18.6px] text-[12.4px] leading-[20.8px]">
            {m.bullets.map((b) => (
              <li key={b.title}>
                <span className="font-semibold">{b.title}</span> {b.text}
                {b.source && (
                  <>
                    {" "}
                    <Cite>{b.source}</Cite>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex w-full flex-col rounded-[11.2px] border-[0.8px] border-foreground/6 bg-foreground/5">
            <div className="flex items-center justify-between px-[9.6px] py-[5.6px] text-muted-foreground">
              <span className="text-[9.6px]">{m.code.label}</span>
              <Icon name="landing-copy" size={11.2} className="text-icon" />
            </div>
            <div className="px-[12.8px] py-[9.6px] font-mono text-[10.8px] leading-[17.6px]">{m.code.content}</div>
          </div>
          <p className="text-[12.4px] leading-[20.8px]">{m.followUp}</p>
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
        </div>
      </div>
    </div>
  );
}

function Cite({ children }: { children: string }) {
  return <span className="text-[9.6px] font-medium text-subtle">{children}</span>;
}

function Composer({ p }: { p: LandingPreview }) {
  return (
    <>
      <div
        className={cn(
          miniGlass,
          "absolute top-[618.88px] left-[395.2px] flex w-[592px] flex-col gap-2 rounded-[22.4px] py-[11.2px] pr-[9.6px] pl-[12.8px]",
        )}
      >
        <span className="h-[15px] text-[12.4px] leading-[15px] whitespace-nowrap text-foreground">
          <TypewriterLoop
            phrases={p.composerTypingPrompts}
            startDelayMs={1400}
            caretClassName="text-brand-blue-strong"
          />
        </span>
        <div className="flex items-center gap-[4.8px]">
          <span className="flex size-[27.2px] items-center justify-center text-icon">
            <Icon name="plus" size={14.4} />
          </span>
          <span className="bg-primary-fill flex items-center gap-[4.8px] rounded-full px-[9.6px] py-[5.6px] text-[10px] font-medium">
            <Icon name="globe" size={11.2} />
            Search
          </span>
          <span className="flex-1" />
          <span className="flex size-[27.2px] items-center justify-center text-icon">
            <Icon name="mic" size={13.6} />
          </span>
          <span className="bg-primary-fill flex size-[28.8px] items-center justify-center rounded-full">
            <Icon name="up" size={13.6} />
          </span>
        </div>
      </div>
      <p className="absolute top-[700px] left-[395.2px] w-[592px] text-center text-[9.2px] text-subtle">
        {p.disclaimer}
      </p>
    </>
  );
}

export function HeroPreview({ preview: p }: { preview: LandingPreview }) {
  return (
    <div className="px-4 sm:px-8 xl:px-0">
      <PreviewFrame>
        {/* Glass Window — Figma "Glass/Device" */}
        <div className="absolute top-2.5 left-2.5 h-[748px] w-[1180px] overflow-hidden rounded-[34px] border-[1.2px] border-border-glass bg-[linear-gradient(148deg,var(--glass-from),var(--glass-to)_83%)] shadow-device">
          <div className="bg-window absolute top-[12.8px] left-[12.8px] h-[720px] w-[1152px] overflow-hidden rounded-[19.2px]">
            <Glow tone="blue" blur={96} drift={20} className="top-[528px] left-[-112px] size-[272px]" />
            <Glow tone="orange" blur={88} drift={20} duration={22} className="top-[-80px] left-[960px] size-[240px]" />

            <Sidebar p={p} />

            <div className="absolute top-5 left-[246.4px] flex items-center gap-1 rounded-[9.6px] px-2 py-[4.8px] text-foreground">
              <span className="text-[12px] font-semibold">{p.model}</span>
              <Icon name="chev" size={11.2} className="text-icon" />
            </div>

            <div className={cn(miniGlass, "absolute top-[14.4px] left-[562.4px] flex gap-[1.6px] rounded-[12.8px] p-[3.2px]")}>
              {p.tabs.map((t) => (
                <span
                  key={t.label}
                  className={cn(
                    "flex items-center gap-[5.6px] rounded-[9.6px] px-[12.8px] py-[7.2px] text-[10.8px] font-medium",
                    t.active ? "bg-surface-raised text-foreground shadow-soft" : "text-muted-foreground",
                  )}
                >
                  <Icon name={t.icon} size={12} className={t.active ? "text-foreground" : "text-icon"} />
                  {t.label}
                </span>
              ))}
            </div>

            <Thread p={p} />
            <Composer p={p} />
          </div>
        </div>

        {/* Floating callouts */}
        {p.floatChips.map((c, i) => (
          <span
            key={c.label}
            className={cn(
              "glass absolute flex items-center gap-1.5 rounded-full px-4 py-[11px] text-[13px] leading-[normal] font-medium whitespace-nowrap text-foreground",
              i === 0 ? "top-[566px] left-[-40px]" : "top-[650px] left-[1010px]",
            )}
          >
            <Icon name={c.icon} size={14} />
            {c.label}
          </span>
        ))}
      </PreviewFrame>
    </div>
  );
}
