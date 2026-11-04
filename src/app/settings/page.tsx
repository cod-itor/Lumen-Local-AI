import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Cpu, Info, Laptop, LogOut, Sparkles, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Glow, Reveal } from "@/components/landing/motion";
import { Logo } from "@/components/landing/top-nav";
import { AppearanceSettings } from "@/components/settings/appearance";
import { CopyCommand } from "@/components/settings/copy-command";
import { SettingsIcon } from "@/components/settings/icons";
import { ModelRoles, StatePill } from "@/components/settings/model-roles";
import { RuntimeStatus } from "@/components/settings/runtime-status";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/services/app";
import { getAiSettings } from "@/services/settings";
import type { PrivacyRow } from "@/types/settings";

export const metadata: Metadata = {
  title: "Settings — Lumen",
  description: "Which AI models run Lumen on your computer, what each one does, and the rules Lumen gives them.",
};

const NAV = [
  { id: "how-it-works", label: "How Lumen’s AI works" },
  { id: "models", label: "Models by job" },
  { id: "installed", label: "Installed models" },
  { id: "setup", label: "Setup guide" },
  { id: "guardrails", label: "Rules & guardrails" },
  { id: "privacy", label: "What leaves your device" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
];

const LEAVES: Record<PrivacyRow["level"], string> = {
  none: "bg-success/15 text-success-foreground",
  some: "bg-brand-orange-soft text-foreground",
  planned: "bg-foreground/8 text-muted-foreground",
};

export default async function SettingsPage() {
  const [ai, user] = await Promise.all([getAiSettings(), getCurrentUser()]);

  return (
    <div className="relative flex-1 overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[1440px] -translate-x-1/2">
        <Glow tone="blue" className="top-[40px] left-[60px] h-[420px] w-[480px]" blur={120} />
        <Glow tone="orange" className="top-[900px] left-[900px] h-[460px] w-[520px]" blur={120} duration={22} />
      </div>

      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-8">
        <nav className="glass mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-2xl pr-2 pl-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Lumen home">
              <Logo />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden text-[15px] font-medium text-muted-foreground sm:block">Settings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/chat" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}>
              <ArrowLeft /> Back to Lumen
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-10 pb-24 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <h1 className="text-[30px] font-semibold tracking-[-0.8px] text-foreground lg:text-[26px]">Settings</h1>
          <SettingsNav items={NAV} />
        </div>

        <main className="flex min-w-0 flex-col gap-16">
          {/* 1. How it works */}
          <Section id="how-it-works" title={ai.explainer.title} description={ai.explainer.body}>
            <Reveal className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
              {ai.explainer.points.map((p, i) => (
                <ExplainerStep key={p.title} index={i} title={p.title} detail={p.detail} last={i === ai.explainer.points.length - 1} />
              ))}
            </Reveal>
            <RuntimeStatus runtime={ai.runtime} />
          </Section>

          {/* 2. Models by job */}
          <Section
            id="models"
            title="Models by job"
            description="Lumen uses a different model for each kind of work. Pick which of your installed models does each job — anything you installed that fits will show up."
          >
            <ModelRoles roles={ai.roles} installed={ai.installed} />
          </Section>

          {/* 3. Installed */}
          <Section id="installed" title="Installed models" description="What Lumen found on this computer. Remove models in Ollama to free disk space.">
            <Reveal className="glass overflow-hidden rounded-3xl">
              <ul className="divide-y divide-border">
                {ai.installed.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
                      <SettingsIcon name={m.role === "embedding" ? "rag" : m.role} className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-medium text-foreground">{m.name}</span>
                      <span className="font-mono text-[12px] text-muted-foreground">
                        {m.id} · {m.size}
                      </span>
                    </div>
                    <span className="hidden max-w-[260px] text-[12.5px] text-muted-foreground md:block">{m.capabilities.join(" · ")}</span>
                    <span className="rounded-full bg-foreground/8 px-2.5 py-1 text-[12px] font-medium text-foreground">
                      {m.role === "chat" ? "Learning & chat" : m.role === "embedding" ? "Documents · embeddings" : "Images"}
                    </span>
                    <StatePill state={m.state} progress={m.progress} />
                    {m.state === "downloading" && (
                      <span className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                        <span className="bg-brand-gradient block h-full rounded-full" style={{ width: `${m.progress ?? 0}%` }} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Reveal>
          </Section>

          {/* 4. Setup guide */}
          <Section id="setup" title="Setup guide" description="New computer? Five steps and Lumen is ready.">
            <Reveal className="glass flex flex-col gap-1 rounded-3xl p-3 sm:p-4">
              <ol className="flex flex-col">
                {ai.setup.map((s, i) => (
                  <li key={s.title} className="relative flex gap-4 p-3">
                    {i < ai.setup.length - 1 && <span aria-hidden className="absolute top-12 bottom-0 left-[27px] w-px bg-border" />}
                    <span className="bg-primary-fill relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                      <div>
                        <div className="text-[15px] font-semibold text-foreground">{s.title}</div>
                        <div className="text-[14px] text-muted-foreground">{s.detail}</div>
                      </div>
                      {s.command && <CopyCommand value={s.command} />}
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal className="grid gap-3 sm:grid-cols-3">
              {ai.hardware.map((h) => (
                <div key={h.label} className="glass flex flex-col gap-1 rounded-2xl p-4">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
                    <Cpu className="size-3.5" /> {h.label}
                  </span>
                  <span className="text-[14.5px] font-medium text-foreground">{h.value}</span>
                </div>
              ))}
            </Reveal>
          </Section>

          {/* 5. Guardrails */}
          <Section
            id="guardrails"
            title="Rules & guardrails"
            description="Whatever model you install, Lumen wraps it in the same rules. This is exactly what each model is told and allowed to do."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {ai.guardrails.map((g, i) => (
                <Reveal key={g.id} delay={i * 0.04} className={cn("glass flex flex-col gap-4 rounded-3xl p-5", i === 0 && "md:col-span-2")}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-foreground/8 text-foreground">
                      <SettingsIcon name={g.icon} className="size-5" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[16px] font-semibold text-foreground">{g.title}</span>
                      <span className="text-[12.5px] text-muted-foreground">Applies to: {g.appliesTo}</span>
                    </div>
                  </div>
                  <ul className={cn("grid gap-3", i === 0 && "sm:grid-cols-2")}>
                    {g.rules.map((r) => (
                      <li key={r.title} className="flex flex-col gap-0.5 rounded-2xl bg-foreground/5 p-3.5">
                        <span className="text-[14.5px] font-medium text-foreground">{r.title}</span>
                        <span className="text-[13.5px] leading-[20px] text-muted-foreground">{r.detail}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))}
            </div>
            <Reveal className="flex items-start gap-3 rounded-2xl border border-brand-orange-line/60 bg-brand-orange-soft p-4">
              <Info className="mt-0.5 size-4.5 shrink-0 text-brand-orange-strong dark:text-brand-orange" />
              <p className="text-[14px] leading-[21px] text-foreground">{ai.guardrailNote}</p>
            </Reveal>
          </Section>

          {/* 6. Privacy */}
          <Section id="privacy" title="What leaves your device" description="Where each feature runs, and exactly what (if anything) goes online.">
            <Reveal className="glass overflow-hidden rounded-3xl">
              <table className="w-full text-left text-[14px]">
                <thead className="hidden bg-foreground/5 text-[12px] tracking-wide text-muted-foreground uppercase sm:table-header-group">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">Feature</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Runs on</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Leaves your device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ai.privacy.map((p) => (
                    <tr key={p.feature} className="flex flex-col gap-1.5 px-5 py-4 sm:table-row sm:p-0">
                      <th scope="row" className="font-semibold text-foreground sm:px-5 sm:py-4">{p.feature}</th>
                      <td className="text-muted-foreground sm:px-5 sm:py-4">
                        <span className="inline-flex items-center gap-1.5">
                          <Laptop className="size-3.5" /> {p.runsOn}
                        </span>
                      </td>
                      <td className="sm:px-5 sm:py-4">
                        <span className={cn("inline-block rounded-xl px-2.5 py-1 text-[13px] font-medium", LEAVES[p.level])}>
                          {p.leaves}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Link
              href="/coming-soon"
              className="glass group flex items-center gap-3 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
            >
              <Sparkles className="size-4.5 text-brand-orange-strong dark:text-brand-orange" />
              <span className="flex-1 text-[14px] text-foreground">
                Coming soon: use the models on your laptop from your phone — <span className="font-medium">Lumen Desktop & Remote Access</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Section>

          {/* 7. Appearance */}
          <Section id="appearance" title="Appearance">
            <AppearanceSettings />
          </Section>

          {/* 8. Account */}
          <Section id="account" title="Account">
            <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
              <span className="bg-brand-gradient flex size-11 items-center justify-center rounded-full text-[14px] font-semibold text-white">
                {user.initials}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold text-foreground">{user.name}</span>
                <span className="flex items-center gap-1 text-[13.5px] text-muted-foreground">
                  <UserRound className="size-3.5" /> {user.plan}
                </span>
              </div>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
                <LogOut /> Log out
              </Link>
            </div>
          </Section>
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
