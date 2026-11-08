"use client";

import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Loader2, Pause, Play, ShieldCheck, Square, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/landing/top-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { api } from "@/lib/api";
import { cancelRun, pauseRun, resumeRun, startRun, useEvalRunner } from "@/lib/evals";
import { cn } from "@/lib/utils";
import type {
  EvalCategory,
  EvalMode,
  EvalRunDetailDto,
  EvalRunDto,
  EvalSuiteDto,
  PageResponse,
  ProviderDto,
} from "@/types/api";

/** Score labels of HARNESS.md §12.5 (fixed by the spec, display only). */
function label(score: number): "STRONG" | "GOOD" | "FAIR" | "WEAK" {
  if (score >= 0.85) return "STRONG";
  if (score >= 0.7) return "GOOD";
  if (score >= 0.5) return "FAIR";
  return "WEAK";
}

const CATEGORY_ORDER: EvalCategory[] = [
  "SAFETY", "INJECTION", "RAG_FAITHFULNESS", "RAG_ABSTAIN", "KNOWLEDGE_HUMILITY", "TOOL_USE", "INSTRUCTION", "JSON", "KHMER",
];

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Model Test page (FRONTEND.md §7.7): start, run, scorecard, history and compare. */
export function ModelTest() {
  const m = useMessages();
  const s = m.evals;
  const runner = useEvalRunner();
  const [providers, setProviders] = useState<ProviderDto[] | null>(null);
  const [suite, setSuite] = useState<EvalSuiteDto | null>(null);
  const [runs, setRuns] = useState<EvalRunDto[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [mode, setMode] = useState<EvalMode>("QUICK");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvalRunDetailDto | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    const page = await api.get<PageResponse<EvalRunDto>>("/api/evals/runs?size=50");
    setRuns(page.items);
    return page.items;
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, suites] = await Promise.all([
        api.get<ProviderDto[]>("/api/providers"),
        api.get<EvalSuiteDto[]>("/api/evals/suites"),
      ]);
      setProviders(p);
      setSuite(suites.find((x) => x.id === "core") ?? suites[0] ?? null);
      setProviderId((cur) => cur ?? p.find((x) => x.isDefault)?.id ?? p[0]?.id ?? null);
      const items = await loadRuns();
      setOpenId((cur) => cur ?? items[0]?.id ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [loadRuns]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  // The open run's detail; refreshed whenever the runner finishes another case.
  useEffect(() => {
    if (!openId) return;
    let alive = true;
    api
      .get<EvalRunDetailDto>(`/api/evals/runs/${openId}`)
      .then((d) => alive && setDetail(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [openId, runner.done, runner.running]);

  useEffect(() => {
    if (runner.running) return;
    let alive = true;
    api
      .get<PageResponse<EvalRunDto>>("/api/evals/runs?size=50")
      .then((page) => alive && setRuns(page.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [runner.running, runner.done]);

  const provider = providers?.find((p) => p.id === providerId) ?? null;
  const providerOf = (id: string) => providers?.find((p) => p.id === id) ?? null;

  const start = async () => {
    if (!provider) return;
    setBusy(true);
    setNotice(null);
    try {
      const run = await startRun(provider, mode);
      setOpenId(run.id);
      await loadRuns();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!window.confirm(s.confirmCancel)) return;
    await cancelRun(id).catch(() => undefined);
    await loadRuns();
    setDetail(await api.get<EvalRunDetailDto>(`/api/evals/runs/${id}`).catch(() => null));
  };

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));

  const compared = useMemo(() => compare.map((id) => runs.find((r) => r.id === id)).filter(Boolean) as EvalRunDto[], [
    compare,
    runs,
  ]);

  return (
    <div className="relative flex-1 overflow-x-clip">
      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-8">
        <nav className="glass mx-auto flex h-14 max-w-[980px] items-center justify-between rounded-2xl pr-2 pl-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={m.common.lumenHome}>
              <Logo />
            </Link>
            <span className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden text-[15px] font-medium text-muted-foreground sm:block">{s.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/settings" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}>
              <ArrowLeft /> {s.back}
            </Link>
            <Link href="/chat" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}>
              {m.common.backToLumen}
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[980px] flex-col gap-10 px-4 pt-10 pb-24 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-semibold tracking-[-0.8px] text-foreground">{s.title}</h1>
          <p className="max-w-[680px] text-[15.5px] leading-[24px] text-muted-foreground">{s.description}</p>
          <p className="max-w-[680px] text-[13px] text-muted-foreground">{s.whatIs}</p>
        </div>

        {loadError ? (
          <div className="flex items-center gap-3">
            <p className="text-[14px] text-muted-foreground">{s.loadFailed}</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()}>
              {s.retry}
            </Button>
          </div>
        ) : !providers ? (
          <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {s.loading}
          </p>
        ) : providers.length === 0 ? (
          <div className="glass flex flex-col items-start gap-3 rounded-3xl p-6">
            <p className="text-[14px] text-muted-foreground">{s.noModels}</p>
            <Link href="/settings/models" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
              {s.addModel}
            </Link>
          </div>
        ) : (
          <>
            {/* Start / progress */}
            <section className="glass flex flex-col gap-5 rounded-3xl p-5 sm:p-6">
              {runner.running && runner.runId ? (
                <RunProgress
                  done={runner.done}
                  total={runner.total}
                  modelProgress={runner.modelProgress}
                  onPause={pauseRun}
                  onCancel={() => void cancel(runner.runId!)}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-medium text-muted-foreground">{s.model}</span>
                    <div className="flex flex-wrap gap-2">
                      {providers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProviderId(p.id)}
                          aria-pressed={p.id === providerId}
                          className={cn(
                            "flex items-center gap-2 rounded-full border px-3.5 py-2 text-[14px] transition-colors",
                            p.id === providerId
                              ? "border-foreground/30 bg-foreground/8 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {p.id === providerId && <Check className="size-3.5" />}
                          <span className="font-medium">{p.name}</span>
                          <span className="text-[12.5px] opacity-70">{p.model}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["QUICK", "FULL"] as const).map((md) => (
                      <button
                        key={md}
                        type="button"
                        onClick={() => setMode(md)}
                        aria-pressed={md === mode}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-2xl border p-4 text-left transition-colors",
                          md === mode ? "border-foreground/30 bg-foreground/6" : "border-border hover:bg-foreground/4",
                        )}
                      >
                        <span className="text-[15px] font-medium text-foreground">{md === "QUICK" ? s.quick : s.full}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {format(md === "QUICK" ? s.quickHint : s.fullHint, {
                            count: (md === "QUICK" ? suite?.quickCount : suite?.fullCount) ?? "–",
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button className="rounded-full" disabled={!provider || busy || !suite} onClick={() => void start()}>
                      {busy ? <Loader2 className="animate-spin" /> : <Play />} {s.start}
                    </Button>
                    {notice && <span className="text-[13px] text-destructive">{notice}</span>}
                    {runner.lastError && !runner.running && (
                      <span className="text-[13px] text-muted-foreground">{format(s.error, { code: runner.lastError })}</span>
                    )}
                  </div>
                </>
              )}
            </section>

            {detail && (
              <Scorecard
                run={detail}
                canResume={detail.status === "RUNNING" && !runner.running && !!providerOf(detail.providerId)}
                onResume={() => {
                  const p = providerOf(detail.providerId);
                  if (p) resumeRun(detail.id, p);
                }}
                onCancel={() => void cancel(detail.id)}
              />
            )}

            {compared.length === 2 && <Compare a={compared[0]} b={compared[1]} onClear={() => setCompare([])} />}

            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[22px] font-semibold tracking-[-0.4px] text-foreground">{s.history}</h2>
                <span className="text-[13px] text-muted-foreground">{s.compareHint}</span>
              </div>
              {runs.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">{s.noHistory}</p>
              ) : (
                <ul className="glass divide-y divide-border overflow-hidden rounded-3xl">
                  {runs.map((r) => (
                    <li key={r.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", r.id === openId && "bg-foreground/4")}>
                      <input
                        type="checkbox"
                        aria-label={s.compare}
                        checked={compare.includes(r.id)}
                        onChange={() => toggleCompare(r.id)}
                        className="size-4 accent-current"
                      />
                      <button type="button" className="flex min-w-0 flex-1 flex-col text-left" onClick={() => setOpenId(r.id)}>
                        <span className="truncate text-[14.5px] font-medium text-foreground">
                          {r.model} · {r.mode === "QUICK" ? s.quick : s.full}
                        </span>
                        <span className="text-[12.5px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString()} · {s.status[r.status]} · {r.completedCases}/{r.caseIds.length}
                        </span>
                      </button>
                      {r.score !== null && (
                        <span className="text-[14px] font-semibold text-foreground tabular-nums">{pct(r.score)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RunProgress(props: {
  done: number;
  total: number;
  modelProgress: number | null;
  onPause: () => void;
  onCancel: () => void;
}) {
  const s = useMessages().evals;
  const ratio = props.total ? props.done / props.total : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
          <Loader2 className="size-4 animate-spin" />
          {props.modelProgress !== null
            ? format(s.loadingModel, { pct: Math.round(props.modelProgress * 100) })
            : format(s.running, { n: Math.min(props.done + 1, props.total), total: props.total })}
        </span>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="rounded-full" onClick={props.onPause}>
            <Pause /> {s.pause}
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={props.onCancel}>
            <Square /> {s.cancel}
          </Button>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/8" role="progressbar" aria-valuenow={Math.round(ratio * 100)}>
        <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-500" style={{ width: pct(ratio) }} />
      </div>
    </div>
  );
}

function Scorecard(props: { run: EvalRunDetailDto; canResume: boolean; onResume: () => void; onCancel: () => void }) {
  const s = useMessages().evals;
  const { run } = props;
  const failed = run.results.filter((r) => !r.passed);
  const errored = run.results.filter((r) => r.error !== null).length;
  const json = run.categoryScores.JSON;
  const khmer = run.categoryScores.KHMER;
  return (
    <section className="glass flex flex-col gap-6 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">
            {run.model} · {run.mode === "QUICK" ? s.quick : s.full} · {s.status[run.status]}
          </span>
          {run.score !== null ? (
            <span className="flex items-baseline gap-3">
              <span className="text-[40px] leading-none font-semibold tracking-[-1px] text-foreground tabular-nums">
                {pct(run.score)}
              </span>
              <span className="text-[17px] font-medium text-foreground">{s.labels[label(run.score)]}</span>
            </span>
          ) : (
            <span className="text-[15px] text-muted-foreground">
              {run.completedCases}/{run.caseIds.length}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 text-[13.5px] text-muted-foreground">
          {run.safetyWithGuardrails !== null && (
            <span className="flex items-center gap-2" title={s.safetyHint}>
              <ShieldCheck className="size-4" /> {s.safety}: <b className="text-foreground">{pct(run.safetyWithGuardrails)}</b>
            </span>
          )}
          <span className="flex items-center gap-2">
            <Zap className="size-4" />
            {run.speed.avgTtftMs === null && run.speed.avgTokensPerSec === null
              ? s.noSpeed
              : [
                  run.speed.avgTtftMs !== null ? format(s.ttft, { ms: Math.round(run.speed.avgTtftMs) }) : null,
                  run.speed.avgTokensPerSec !== null ? format(s.tps, { tps: run.speed.avgTokensPerSec.toFixed(1) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </div>
      </div>

      {run.status === "FAILED" && <p className="text-[13.5px] text-destructive">{s.failedRun}</p>}
      {run.status === "RUNNING" && (
        <div className="flex flex-wrap items-center gap-2">
          {props.canResume && (
            <>
              <span className="text-[13.5px] text-muted-foreground">{s.paused}</span>
              <Button size="sm" className="rounded-full" onClick={props.onResume}>
                <Play /> {s.resume}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={props.onCancel}>
                <X /> {s.cancel}
              </Button>
            </>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {CATEGORY_ORDER.filter((c) => run.categoryScores[c]).map((c) => {
          const v = run.categoryScores[c]!;
          return (
            <li key={c} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="text-foreground">{s.categories[c]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {v.passed}/{v.total}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
                <div className="h-full rounded-full bg-foreground/70" style={{ width: pct(v.score) }} />
              </div>
            </li>
          );
        })}
      </ul>

      {errored > 0 && <p className="text-[13px] text-muted-foreground">{format(s.errored, { count: errored })}</p>}
      {json && json.score < 0.5 && <p className="text-[13.5px] text-foreground">{s.jsonWarning}</p>}
      {khmer && (
        <p className="text-[12.5px] text-muted-foreground">
          {run.mode === "FULL" && khmer.total > 0 && khmer.passed * 3 <= khmer.total ? `${s.khmerOff} ` : ""}
          {s.khmerNote}
        </p>
      )}

      {run.results.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-foreground">{s.failedCases}</h3>
          {failed.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">{s.allPassed}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {failed.map((r) => (
                <li key={r.caseId}>
                  <details className="group rounded-2xl border border-border px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-[13px] text-foreground">{r.caseId}</span>
                        <span className="text-[12.5px] text-muted-foreground">{s.categories[r.category]}</span>
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 flex flex-col gap-2 text-[13px]">
                      {r.error ? (
                        <p className="text-muted-foreground">{format(s.error, { code: r.error })}</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {r.checks
                            .filter((c) => !c.passed)
                            .map((c) => (
                              <li key={c.name} className="text-foreground">
                                <span className="font-mono">{c.name}</span>
                                {c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}
                              </li>
                            ))}
                        </ul>
                      )}
                      <span className="text-[12px] font-medium text-muted-foreground">{s.output}</span>
                      <pre className="max-h-64 overflow-auto rounded-xl bg-foreground/5 p-3 text-[12.5px] whitespace-pre-wrap text-foreground">
                        {r.output || s.emptyOutput}
                      </pre>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Compare({ a, b, onClear }: { a: EvalRunDto; b: EvalRunDto; onClear: () => void }) {
  const s = useMessages().evals;
  const cats = CATEGORY_ORDER.filter((c) => a.categoryScores[c] || b.categoryScores[c]);
  const name = (r: EvalRunDto) => `${r.model} · ${r.mode === "QUICK" ? s.quick : s.full}`;
  return (
    <section className="glass flex flex-col gap-4 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">{s.compare}</h2>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClear}>
          {s.clearCompare}
        </Button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 text-[13.5px]">
        <span />
        <span className="max-w-[140px] truncate text-right font-medium text-foreground">{name(a)}</span>
        <span className="max-w-[140px] truncate text-right font-medium text-foreground">{name(b)}</span>
        <span className="font-medium text-foreground">{s.score}</span>
        <span className="text-right tabular-nums">{a.score === null ? "–" : pct(a.score)}</span>
        <span className="text-right tabular-nums">{b.score === null ? "–" : pct(b.score)}</span>
        {cats.map((c) => (
          <Row key={c} label={s.categories[c]} a={a.categoryScores[c]?.score} b={b.categoryScores[c]?.score} />
        ))}
      </div>
    </section>
  );
}

function Row({ label, a, b }: { label: string; a?: number; b?: number }) {
  const bar = (v?: number) => (
    <span className="flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-foreground/8 sm:block">
        <span className="block h-full rounded-full bg-foreground/70" style={{ width: v === undefined ? 0 : pct(v) }} />
      </span>
      <span className="w-10 text-right tabular-nums">{v === undefined ? "–" : pct(v)}</span>
    </span>
  );
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      {bar(a)}
      {bar(b)}
    </>
  );
}
