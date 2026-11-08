"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Clock3, Lightbulb, Loader } from "lucide-react";
import type { ReactNode } from "react";
import { Glow, Reveal } from "@/components/landing/motion";
import { GlassChip } from "@/components/landing/primitives";
import { Logo } from "@/components/landing/top-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import type { Localized } from "@/i18n/config";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { format } from "@/i18n/messages";
import type { RoadmapMessages } from "@/i18n/messages/en/roadmap";
import { useLocalized, useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { ComingSoonFeature, RoadmapContent, RoadmapStatus } from "@/types/roadmap";
import { DevicePreview } from "./device-preview";
import { RoadmapIcon } from "./icons";
import { ArchitectureWithJourney } from "./journey";

type StatusKey = keyof RoadmapMessages["status"];

const STATUS: Record<RoadmapStatus, { label: StatusKey; icon: typeof Check; className: string }> = {
  done: { label: "done", icon: Check, className: "bg-success/15 text-success-foreground" },
  "in-progress": { label: "inProgress", icon: Loader, className: "bg-brand-blue-soft text-foreground" },
  planned: { label: "planned", icon: CircleDashed, className: "bg-foreground/8 text-muted-foreground" },
};

/** The whole /coming-soon page, rendered in the current language. */
export function RoadmapView({ bundle }: { bundle: Localized<RoadmapContent> }) {
  const roadmap = useLocalized(bundle);
  const m = useMessages();

  return (
    <div className="relative flex-1 overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[1440px] -translate-x-1/2">
        <Glow tone="blue" className="top-[60px] left-[120px] h-[460px] w-[520px]" blur={120} />
        <Glow tone="orange" className="top-[160px] left-[820px] h-[480px] w-[540px]" blur={120} duration={22} />
        <Glow tone="orange" className="top-[1500px] left-[-160px] size-[520px]" blur={120} duration={20} />
        <Glow tone="blue" className="top-[2600px] left-[1000px] size-[520px]" blur={120} duration={24} />
      </div>

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-8">
        <nav className="glass mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-2xl pr-2 pl-4">
          <Link href="/" aria-label={m.common.lumenHome}>
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher size="sm" />
            <ThemeToggle />
            <Link
              href="/chat"
              aria-label={m.common.backToLumen}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}
            >
              {/* Icon-only on phones so the nav fits with the language switch */}
              <ArrowLeft /> <span className="hidden sm:inline">{m.common.backToLumen}</span>
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative mx-auto flex max-w-[1180px] flex-col gap-24 px-4 pt-16 pb-24 sm:px-8 sm:pt-20">
        {/* Intro + index of planned features */}
        <Reveal className="flex flex-col items-center gap-5 text-center">
          <GlassChip className="gap-1.5 px-3.5 py-2 text-[13px] font-medium">
            <span className="size-2 animate-pulse rounded-full bg-brand-orange" />
            {format(m.roadmap.updated, { date: roadmap.updated })}
          </GlassChip>
          <h1 className="text-[44px] leading-[1.05] font-semibold tracking-[-1.6px] text-foreground sm:text-[64px] sm:tracking-[-2.2px]">
            {roadmap.title}
          </h1>
          <p className="max-w-[640px] text-[17px] leading-[26px] text-muted-foreground sm:text-[18px] sm:leading-[28px]">
            {roadmap.intro}
          </p>
          <ul className="mt-2 flex w-full max-w-[640px] flex-col gap-3">
            {roadmap.features.map((f) => (
              <li key={f.id}>
                <a
                  href={`#${f.id}`}
                  className="glass group flex items-center gap-4 rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
                >
                  <span className="bg-primary-fill flex size-11 shrink-0 items-center justify-center rounded-2xl">
                    <Lightbulb className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[15.5px] font-semibold text-foreground">{f.title}</span>
                    <span className="truncate text-[13.5px] text-muted-foreground">{f.tagline}</span>
                  </span>
                  <StatusPill status={f.status} />
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </Reveal>

        {roadmap.features.map((f) => (
          <Feature key={f.id} feature={f} />
        ))}
      </main>
    </div>
  );
}

function Feature({ feature: f }: { feature: ComingSoonFeature }) {
  const t = useMessages().roadmap;
  return (
    <article id={f.id} className="flex scroll-mt-24 flex-col gap-24">
      {/* Feature hero */}
      <Reveal className="flex flex-col items-center gap-5 text-center">
        <GlassChip className="gap-1.5 px-3 py-1.5 text-[12px] font-semibold">
          <Clock3 className="size-3.5" /> {f.badge}
        </GlassChip>
        <h2 className="max-w-[820px] text-[36px] leading-[1.1] font-semibold tracking-[-1.2px] text-foreground sm:text-[52px] sm:tracking-[-1.6px]">
          {f.title}
        </h2>
        <p className="text-[19px] font-medium text-foreground-tertiary sm:text-[22px]">{f.tagline}</p>
        <p className="max-w-[720px] text-[16px] leading-[26px] text-muted-foreground sm:text-[17px]">{f.summary}</p>
        <dl className="mt-2 grid w-full max-w-[820px] grid-cols-2 gap-3 sm:grid-cols-4">
          {f.facts.map((x) => (
            <div key={x.label} className="glass flex flex-col gap-1 rounded-2xl p-4">
              <dt className="text-[12px] text-muted-foreground">{x.label}</dt>
              <dd className="text-[14.5px] font-semibold text-foreground">{x.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Section eyebrow={t.bigPicture.eyebrow} title={t.bigPicture.title} subtitle={t.bigPicture.subtitle}>
        <ArchitectureWithJourney
          nodes={f.architecture.nodes}
          links={f.architecture.links}
          notes={f.architecture.notes}
          steps={f.journey}
        />
      </Section>

      <Section eyebrow={t.howItWorks.eyebrow} title={t.howItWorks.title}>
        <div role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {f.howItWorks.map((s, i) => (
            <Reveal key={s.title} role="listitem" delay={i * 0.06} className="glass flex flex-col gap-3 rounded-3xl p-5">
              <span className="bg-primary-fill flex size-9 items-center justify-center rounded-full text-[14px] font-semibold">
                {i + 1}
              </span>
              <h3 className="text-[16px] font-semibold text-foreground">{s.title}</h3>
              <p className="text-[14px] leading-[21px] text-muted-foreground">{s.detail}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6">
          <FlowRow title={t.howItWorks.firstRun} steps={f.firstRun} />
        </Reveal>
      </Section>

      <Section eyebrow={t.preview.eyebrow} title={t.preview.title} subtitle={t.preview.subtitle}>
        <Reveal>
          <DevicePreview />
        </Reveal>
      </Section>

      <Section eyebrow={t.changes.eyebrow} title={t.changes.title}>
        <Reveal className="glass overflow-hidden rounded-3xl">
          <table className="w-full text-left text-[14px]">
            <thead className="hidden bg-foreground/5 text-[12px] tracking-wide text-muted-foreground uppercase sm:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">{t.changes.area}</th>
                <th scope="col" className="px-5 py-3 font-semibold">{t.changes.today}</th>
                <th scope="col" className="px-5 py-3 font-semibold">{t.changes.planned}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {f.changes.map((c) => (
                <tr key={c.area} className="flex flex-col gap-1 px-5 py-4 sm:table-row sm:p-0">
                  <th scope="row" className="font-semibold text-foreground sm:px-5 sm:py-4 sm:align-top">{c.area}</th>
                  <td className="text-muted-foreground sm:px-5 sm:py-4 sm:align-top">
                    <span className="text-[12px] font-medium sm:hidden">{t.changes.todayLabel}</span>
                    {c.now}
                  </td>
                  <td className="text-foreground sm:px-5 sm:py-4 sm:align-top">
                    <span className="inline-flex items-start gap-2">
                      <ArrowRight className="mt-[3px] size-3.5 shrink-0 text-brand-orange-strong dark:text-brand-orange" />
                      {c.planned}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </Section>

      <Section eyebrow={t.tech.eyebrow} title={t.tech.title}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {f.tech.map((t, i) => {
            return (
              <Reveal key={t.name} delay={i * 0.05} className="glass flex gap-4 rounded-3xl p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-foreground/8 text-foreground">
                  <RoadmapIcon name={t.icon} className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-muted-foreground">{t.role}</span>
                  <span className="text-[15.5px] font-semibold text-foreground">{t.name}</span>
                  <span className="text-[13.5px] leading-[20px] text-muted-foreground">{t.detail}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-6">
          <FlowRow
            title={t.tech.pairing}
            steps={f.pairing.map((p) => p.title)}
            details={f.pairing.map((p) => p.detail)}
          />
        </Reveal>
      </Section>

      <Section eyebrow={t.tradeOffs.eyebrow} title={t.tradeOffs.title}>
        <div className="grid gap-4 sm:grid-cols-2">
          {f.tradeOffs.map((t, i) => {
            return (
              <Reveal key={t.title} delay={i * 0.05} className="glass flex gap-4 rounded-3xl p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-orange-soft text-brand-orange-strong dark:text-brand-orange">
                  <RoadmapIcon name={t.icon} className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15.5px] font-semibold text-foreground">{t.title}</span>
                  <span className="text-[14px] leading-[21px] text-muted-foreground">{t.detail}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <Section eyebrow={t.buildOrder.eyebrow} title={t.buildOrder.title} subtitle={t.buildOrder.subtitle}>
        <div role="list" className="relative mx-auto flex w-full max-w-[720px] flex-col gap-4">
          <span aria-hidden className="absolute top-4 bottom-4 left-[19px] w-px bg-border" />
          {f.phases.map((p, i) => (
            <Reveal key={p.title} role="listitem" delay={i * 0.06}>
              <div className="relative flex gap-4">
                <span
                  className={cn(
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold",
                    p.status === "in-progress" ? "bg-primary-fill" : "glass text-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div className="glass flex flex-1 flex-col gap-1 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15.5px] font-semibold text-foreground">{p.title}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <span className="text-[14px] text-muted-foreground">{p.detail}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        eyebrow={t.notes.eyebrow}
        title={t.notes.title}
        subtitle={t.notes.subtitle}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal className="glass flex flex-col gap-3 overflow-hidden rounded-3xl p-5 lg:col-span-2">
            <h3 className="text-[15.5px] font-semibold text-foreground">
              {t.notes.tableBefore}
              <code className="font-mono">devices</code>
              {t.notes.tableAfter}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13.5px]">
                <thead className="text-[12px] text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">{t.notes.column}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">{t.notes.type}</th>
                    <th scope="col" className="py-2 font-medium">{t.notes.why}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {f.extras.devicesTable.map((c) => (
                    <tr key={c.name}>
                      <td className="py-2 pr-4 font-mono text-foreground">{c.name}</td>
                      <td className="py-2 pr-4 font-mono text-muted-foreground">{c.type}</td>
                      <td className="py-2 text-muted-foreground">{c.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal className="glass flex flex-col gap-3 rounded-3xl p-5 lg:col-span-2">
            <h3 className="text-[15.5px] font-semibold text-foreground">{t.notes.protocol}</h3>
            <pre className="overflow-x-auto rounded-2xl border border-foreground/8 bg-foreground/5 p-4 font-mono text-[12.5px] leading-[20px] text-foreground-secondary">
              {f.extras.protocol}
            </pre>
          </Reveal>
          <NoteList title={t.notes.security} items={f.extras.security} check />
          <NoteList title={t.notes.openQuestions} items={f.extras.openQuestions} />
        </div>
      </Section>
    </article>
  );
}

function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-8">
      <Reveal className="flex flex-col items-center gap-3 text-center">
        <GlassChip className="px-3 py-1.5 text-[11.5px] font-semibold tracking-wide uppercase">{eyebrow}</GlassChip>
        <h2 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.9px] text-foreground sm:text-[38px]">{title}</h2>
        {subtitle && <p className="max-w-[600px] text-[15.5px] text-muted-foreground">{subtitle}</p>}
      </Reveal>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: RoadmapStatus }) {
  const labels = useMessages().roadmap.status;
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap", s.className)}>
      <Icon className="size-3" strokeWidth={2.4} />
      {labels[s.label]}
    </span>
  );
}

/** Horizontal chain of steps (wraps to a vertical list on phones). */
function FlowRow({ title, steps, details }: { title: string; steps: string[]; details?: string[] }) {
  return (
    <div className="glass flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
      <h3 className="text-[15.5px] font-semibold text-foreground">{title}</h3>
      <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 lg:flex-1 lg:gap-0">
            <div className="flex flex-1 items-start gap-3 rounded-2xl bg-foreground/5 p-3 lg:flex-col lg:gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11.5px] font-semibold text-foreground">
                {i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[13.5px] leading-[18px] font-medium text-foreground [:lang(km)_&]:leading-[22px]">{s}</span>
                {details?.[i] && <span className="text-[12.5px] leading-[17px] text-muted-foreground [:lang(km)_&]:leading-[21px]">{details[i]}</span>}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight aria-hidden className="hidden size-4 shrink-0 self-center text-muted-foreground lg:mx-2 lg:block" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function NoteList({ title, items, check }: { title: string; items: string[]; check?: boolean }) {
  return (
    <Reveal className="glass flex flex-col gap-3 rounded-3xl p-5">
      <h3 className="text-[15.5px] font-semibold text-foreground">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5 text-[14px] leading-[20px] text-muted-foreground">
            {check ? (
              <Check className="mt-[3px] size-3.5 shrink-0 text-success" strokeWidth={2.6} />
            ) : (
              <span className="mt-[2px] flex size-4 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-semibold text-foreground">
                ?
              </span>
            )}
            {it}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
