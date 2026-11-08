"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, Cpu, Info, Laptop, Sparkles } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Glow, Reveal } from "@/components/landing/motion";
import { Logo } from "@/components/landing/top-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import type { Localized } from "@/i18n/config";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { format } from "@/i18n/messages";
import { useLocalized, useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { AiSettingsContent, PrivacyRow } from "@/types/settings";
import { AppearanceSettings } from "./appearance";
import { CopyCommand } from "./copy-command";
import { SettingsIcon } from "./icons";
import { AccountCard, AnswerLanguage, YourModels } from "./live-settings";
import { AskBeforeSearch } from "./ask-before-search";
import { SettingsNav, type SettingsNavItem } from "./settings-nav";

const NAV_IDS = [
  ["account", "account"],
  ["models", "models"],
  ["language", "language"],
  ["appearance", "appearance"],
  ["privacy", "privacy"],
  ["about", "about"],
] as const;

const LEAVES: Record<PrivacyRow["level"], string> = {
  none: "bg-success/15 text-success-foreground",
  some: "bg-brand-orange-soft text-foreground",
  planned: "bg-foreground/8 text-muted-foreground",
};

/**
 * The whole Settings page, rendered on the client so it follows the chosen
 * language instantly. `content` carries every language; we pick one here.
 */
export function SettingsView({ content }: { content: Localized<AiSettingsContent> }) {
  const ai = useLocalized(content);
  const m = useMessages();
  const s = m.settings;
  // Stable per language, so the nav's scroll observer isn't rebuilt every render.
  const nav = useMemo<SettingsNavItem[]>(() => NAV_IDS.map(([id, key]) => ({ id, label: s.nav[key] })), [s.nav]);

  return (
    <div className="relative flex-1 overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[1440px] -translate-x-1/2">
        <Glow tone="blue" className="top-[40px] left-[60px] h-[420px] w-[480px]" blur={120} />
        <Glow tone="orange" className="top-[900px] left-[900px] h-[460px] w-[520px]" blur={120} duration={22} />
      </div>

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-8">
        <nav className="glass mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-2xl pr-2 pl-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={m.common.lumenHome}>
              <Logo />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden text-[15px] font-medium text-muted-foreground sm:block">{s.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/chat" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}>
              <ArrowLeft /> {m.common.backToLumen}
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-10 pb-24 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <h1 className="text-[30px] font-semibold tracking-[-0.8px] text-foreground lg:text-[26px]">{s.title}</h1>
          <SettingsNav items={nav} />
        </div>

        <main className="flex min-w-0 flex-col gap-14">
          <Section id="account" title={s.account.title}>
            <AccountCard />
          </Section>

          <Section id="models" title={s.yourModels.title} description={s.yourModels.description}>
            <YourModels />
          </Section>

          <Section id="language" title={s.language.title}>
            <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold text-foreground">{s.language.label}</span>
                <span className="text-[13.5px] text-muted-foreground">{m.common.languageHint}</span>
              </div>
              <LanguageSwitcher />
            </div>
            <AnswerLanguage />
          </Section>

          <Section id="appearance" title={s.appearance.title}>
            <AppearanceSettings />
          </Section>

          <Section id="privacy" title={s.nav.privacy}>
            <AskBeforeSearch />
          </Section>

          {/* Reference material, collapsed: most people never need it. */}
          <details id="about" className="group scroll-mt-24 rounded-3xl border border-border">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
                <Info className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-semibold text-foreground">{s.about.title}</span>
                <span className="text-[13.5px] text-muted-foreground">{s.about.description}</span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>

            <div className="flex flex-col gap-12 px-5 pt-2 pb-6">
              <Section id="how-it-works" title={ai.explainer.title} description={ai.explainer.body}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                  {ai.explainer.points.map((p, i) => (
                    <ExplainerStep key={i} index={i} title={p.title} detail={p.detail} last={i === ai.explainer.points.length - 1} />
                  ))}
                </div>
              </Section>

              <Section id="setup" title={s.setup.title} description={s.setup.description}>
                <div className="glass flex flex-col gap-1 rounded-3xl p-3 sm:p-4">
                  <ol className="flex flex-col">
                    {ai.setup.map((step, i) => (
                      <li key={i} className="relative flex gap-4 p-3">
                        {i < ai.setup.length - 1 && <span aria-hidden className="absolute top-12 bottom-0 left-[27px] w-px bg-border" />}
                        <span className="bg-primary-fill relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
                          {i + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                          <div>
                            <div className="text-[15px] font-semibold text-foreground">{step.title}</div>
                            <div className="text-[14px] text-muted-foreground">{step.detail}</div>
                          </div>
                          {step.command && <CopyCommand value={step.command} />}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {ai.hardware.map((h, i) => (
                    <div key={i} className="glass flex flex-col gap-1 rounded-2xl p-4">
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
                        <Cpu className="size-3.5" /> {h.label}
                      </span>
                      <span className="text-[14.5px] font-medium text-foreground">{h.value}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="guardrails" title={s.guardrails.title} description={s.guardrails.description}>
                <div className="grid gap-4 md:grid-cols-2">
                  {ai.guardrails.map((g, i) => (
                    <div key={g.id} className={cn("glass flex flex-col gap-4 rounded-3xl p-5", i === 0 && "md:col-span-2")}>
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-2xl bg-foreground/8 text-foreground">
                          <SettingsIcon name={g.icon} className="size-5" />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[16px] font-semibold text-foreground">{g.title}</span>
                          <span className="text-[12.5px] text-muted-foreground">{format(s.guardrails.appliesTo, { target: g.appliesTo })}</span>
                        </div>
                      </div>
                      <ul className={cn("grid gap-3", i === 0 && "sm:grid-cols-2")}>
                        {g.rules.map((r, j) => (
                          <li key={j} className="flex flex-col gap-0.5 rounded-2xl bg-foreground/5 p-3.5">
                            <span className="text-[14.5px] font-medium text-foreground">{r.title}</span>
                            <span className="text-[13.5px] leading-[20px] text-muted-foreground">{r.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-brand-orange-line/60 bg-brand-orange-soft p-4">
                  <Info className="mt-0.5 size-4.5 shrink-0 text-brand-orange-strong dark:text-brand-orange" />
                  <p className="text-[14px] leading-[21px] text-foreground">{ai.guardrailNote}</p>
                </div>
              </Section>

              <Section id="data" title={s.privacy.title} description={s.privacy.description}>
                <div className="glass overflow-hidden rounded-3xl">
                  <table className="w-full text-left text-[14px]">
                    <thead className="hidden bg-foreground/5 text-[12px] tracking-wide text-muted-foreground uppercase sm:table-header-group">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">{s.privacy.feature}</th>
                        <th scope="col" className="px-5 py-3 font-semibold">{s.privacy.runsOn}</th>
                        <th scope="col" className="px-5 py-3 font-semibold">{s.privacy.leaves}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ai.privacy.map((p, i) => (
                        <tr key={i} className="flex flex-col gap-1.5 px-5 py-4 sm:table-row sm:p-0">
                          <th scope="row" className="font-semibold text-foreground sm:px-5 sm:py-4">{p.feature}</th>
                          <td className="text-muted-foreground sm:px-5 sm:py-4">
                            <span className="inline-flex items-center gap-1.5">
                              <Laptop className="size-3.5" /> {p.runsOn}
                            </span>
                          </td>
                          <td className="sm:px-5 sm:py-4">
                            <span className={cn("inline-block rounded-xl px-2.5 py-1 text-[13px] font-medium", LEAVES[p.level])}>{p.leaves}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link href="/coming-soon" className="glass group flex items-center gap-3 rounded-2xl p-4 transition-transform hover:-translate-y-0.5">
                  <Sparkles className="size-4.5 text-brand-orange-strong dark:text-brand-orange" />
                  <span className="flex-1 text-[14px] text-foreground">
                    {s.privacy.comingSoon} <span className="font-medium">{s.privacy.comingSoonProduct}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Section>
            </div>
          </details>
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-5">
      <Reveal className="flex flex-col gap-2">
        <h2 id={`${id}-title`} className="text-[24px] leading-[30px] font-semibold tracking-[-0.5px] text-foreground sm:text-[26px]">
          {title}
        </h2>
        {description && <p className="max-w-[680px] text-[15.5px] leading-[24px] text-muted-foreground">{description}</p>}
      </Reveal>
      {children}
    </section>
  );
}

function ExplainerStep({ index, title, detail, last }: { index: number; title: string; detail: string; last: boolean }) {
  return (
    <>
      <div className="glass flex flex-col gap-2 rounded-2xl p-4">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-foreground/8 text-[12px]">{index + 1}</span>
          {title}
        </span>
        <span className="text-[14px] leading-[20px] text-muted-foreground">{detail}</span>
      </div>
      {!last && <ArrowRight aria-hidden className="mx-auto size-4 rotate-90 self-center text-muted-foreground md:rotate-0" />}
    </>
  );
}
