"use client";

import Link from "next/link";
import { ArrowLeft, Check, Copy, Globe, HardDrive, Laptop, Loader2, Server, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/landing/top-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { testOllama, type OllamaTestCode } from "@/lib/providers/ollamaTest";
import { providerCatalog, providerRegistry } from "@/lib/providers/registry";
import { webgpuSupport } from "@/lib/providers/webgpu";
import { DEMO } from "@/lib/demo/mode";
import { cn } from "@/lib/utils";
import type { CreateProviderRequest, ProviderCatalogDto, ProviderDto, ProviderTestResultRequest } from "@/types/api";

const DEFAULT_OLLAMA = "http://localhost:11434";

const KIND_ICON = { HOST: Server, BROWSER: Globe, LOCAL_OLLAMA: Laptop, REMOTE_URL: HardDrive } as const;

/** Settings → Models (FRONTEND.md §7.8): list, default, test, remove, add a browser model or the visitor's Ollama. */
export function ModelsManager() {
  const m = useMessages();
  const s = m.providers;
  const [providers, setProviders] = useState<ProviderDto[] | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogDto | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [working, setWorking] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.get<ProviderDto[]>("/api/providers"), providerCatalog()]);
      setProviders(p);
      setCatalog(c);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get<ProviderDto[]>("/api/providers"), providerCatalog()])
      .then(([p, c]) => {
        if (!alive) return;
        setProviders(p);
        setCatalog(c);
      })
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const setWork = (id: string, v: string | null) =>
    setWorking((w) => {
      const n = { ...w };
      if (v === null) delete n[id];
      else n[id] = v;
      return n;
    });
  const note = (id: string, v: string) => setNotes((n) => ({ ...n, [id]: v }));
  const errText = (e: unknown) => format(s.error, { message: e instanceof Error ? e.message : String(e) });

  /** Test a provider the way its kind needs (FRONTEND.md §7.8 / §8.2) and store the result. */
  const test = async (p: ProviderDto) => {
    setWork(p.id, s.testing);
    try {
      if (p.kind === "HOST" || DEMO) {
        await api.post<ProviderDto>(`/api/providers/${p.id}/test`);
      } else if (p.kind === "LOCAL_OLLAMA") {
        const r = await testOllama(p.baseUrl ?? DEFAULT_OLLAMA, p.model);
        const body: ProviderTestResultRequest = {
          ok: r.ok,
          checks: r.checks.map(({ name, ok, message }) => ({ name, ok, message })),
          modelInfo: r.modelInfo,
        };
        await api.post<ProviderDto>(`/api/providers/${p.id}/test-result`, body);
        if (r.failed) note(p.id, s.ollama.errors[r.failed]);
      } else if (p.kind === "BROWSER") {
        const body: ProviderTestResultRequest = { ok: true, checks: [{ name: "load", ok: true, message: null }] };
        try {
          const client = await providerRegistry.get(p);
          await client.ensureReady((pct) => setWork(p.id, format(s.browser.downloading, { pct: Math.round(pct * 100) })));
          note(p.id, s.browser.added);
        } catch (e) {
          body.ok = false;
          body.checks = [{ name: "load", ok: false, message: (e instanceof Error ? e.message : String(e)).slice(0, 500) }];
          note(p.id, errText(e));
        }
        await api.post<ProviderDto>(`/api/providers/${p.id}/test-result`, body);
      }
    } catch (e) {
      note(p.id, errText(e));
    } finally {
      setWork(p.id, null);
      await load();
    }
  };

  const makeDefault = async (p: ProviderDto) => {
    setWork(p.id, "…");
    await api.post(`/api/providers/${p.id}/default`).catch((e) => note(p.id, errText(e)));
    setWork(p.id, null);
    await load();
  };

  const remove = async (p: ProviderDto) => {
    if (!window.confirm(format(s.confirmRemove, { name: p.name }))) return;
    await api.del(`/api/providers/${p.id}`).catch((e) => note(p.id, errText(e)));
    await load();
  };

  const removeFiles = async (p: ProviderDto) => {
    const entry = catalog?.browser.models.find((b) => b.id === p.model);
    const ids = entry ? [entry.id, entry.fallbackId] : [p.model];
    try {
      const [{ deleteModelAllInfoInCache }, { appConfig }] = await Promise.all([
        import("@mlc-ai/web-llm"),
        import("@/lib/providers/webllm"),
      ]);
      for (const id of ids) await deleteModelAllInfoInCache(id, appConfig);
      note(p.id, s.filesRemoved);
    } catch (e) {
      note(p.id, errText(e));
    }
  };

  /** Create a provider, then run its first test (a browser model downloads here). */
  const create = async (req: CreateProviderRequest) => {
    const p = await api.post<ProviderDto>("/api/providers", req);
    await load();
    await test(p);
  };

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

      <main className="mx-auto flex max-w-[980px] flex-col gap-12 px-4 pt-10 pb-24 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[30px] font-semibold tracking-[-0.8px] text-foreground">{s.title}</h1>
          <p className="max-w-[680px] text-[15.5px] leading-[24px] text-muted-foreground">{s.description}</p>
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
        ) : (
          <ul className="glass divide-y divide-border overflow-hidden rounded-3xl">
            {providers.map((p) => (
              <ProviderRow
                key={p.id}
                p={p}
                working={working[p.id]}
                note={notes[p.id]}
                onTest={() => void test(p)}
                onDefault={() => void makeDefault(p)}
                onRemove={() => void remove(p)}
                onRemoveFiles={() => void removeFiles(p)}
              />
            ))}
          </ul>
        )}

        {catalog && providers && (
          <section className="flex flex-col gap-5">
            <h2 className="text-[24px] font-semibold tracking-[-0.5px] text-foreground">{s.add.title}</h2>
            <AddBrowser catalog={catalog} existing={providers} onAdd={create} />
            <AddOllama catalog={catalog} onAdd={create} />
          </section>
        )}
      </main>
    </div>
  );
}

function ProviderRow(props: {
  p: ProviderDto;
  working?: string;
  note?: string;
  onTest: () => void;
  onDefault: () => void;
  onRemove: () => void;
  onRemoveFiles: () => void;
}) {
  const { p, working } = props;
  const s = useMessages().providers;
  const Icon = KIND_ICON[p.kind];
  const statusTone =
    p.status === "OK" ? "bg-success/15 text-success-foreground" : p.status === "FAILED" ? "bg-destructive/10 text-destructive" : "bg-foreground/8 text-muted-foreground";
  return (
    <li className="flex flex-col gap-3 p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
          <Icon className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
            {p.name}
            {p.isDefault && (
              <span className="bg-primary-fill rounded-full px-2 py-0.5 text-[11.5px] font-semibold">{s.isDefault}</span>
            )}
          </span>
          <span className="font-mono text-[12px] break-all text-muted-foreground">
            {s.kinds[p.kind]} · {p.model}
            {p.baseUrl ? ` · ${p.baseUrl}` : ""}
          </span>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", statusTone)}>{s.status[p.status]}</span>
      </div>
      <p className="text-[13px] text-muted-foreground">{s.kindHints[p.kind]}</p>
      {p.lastTestMessage && p.status !== "UNTESTED" && (
        <p className="text-[13px] text-muted-foreground">{format(s.lastTested, { message: p.lastTestMessage })}</p>
      )}
      {props.note && <p className="text-[13px] text-foreground">{props.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!p.isDefault && (
          <Button size="sm" className="rounded-full" disabled={!!working} onClick={props.onDefault}>
            {s.makeDefault}
          </Button>
        )}
        <Button variant="outline" size="sm" className="rounded-full" disabled={!!working} onClick={props.onTest}>
          {working ? (
            <>
              <Loader2 className="animate-spin" /> {working}
            </>
          ) : (
            s.test
          )}
        </Button>
        {p.kind === "BROWSER" && (
          <Button variant="ghost" size="sm" className="rounded-full" disabled={!!working} onClick={props.onRemoveFiles}>
            {s.removeFiles}
          </Button>
        )}
        {p.kind !== "HOST" && (
          <Button variant="destructive" size="sm" className="rounded-full" disabled={!!working} onClick={props.onRemove}>
            <Trash2 /> {s.remove}
          </Button>
        )}
      </div>
    </li>
  );
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="glass flex flex-col gap-4 rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-foreground/8 text-foreground">{icon}</span>
        <span className="text-[17px] font-semibold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function AddBrowser({
  catalog,
  existing,
  onAdd,
}: {
  catalog: ProviderCatalogDto;
  existing: ProviderDto[];
  onAdd: (r: CreateProviderRequest) => Promise<void>;
}) {
  const s = useMessages().providers;
  const [gpu, setGpu] = useState<{ ok: boolean; f16: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void webgpuSupport().then(setGpu);
  }, []);

  const add = async (id: string, label: string) => {
    setBusy(id);
    setError(null);
    try {
      await onAdd({ kind: "BROWSER", name: label.replace(/\s*\(.*\)$/, ""), model: id });
    } catch (e) {
      setError(format(s.error, { message: e instanceof ApiError || e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card icon={<Globe className="size-5" />} title={s.add.browser}>
      <p className="text-[14px] text-muted-foreground">{s.browser.intro}</p>
      {!gpu ? (
        <p className="text-[13.5px] text-muted-foreground">{s.browser.checking}</p>
      ) : !gpu.ok ? (
        <p className="text-[13.5px] text-foreground">{s.browser.noWebgpu}</p>
      ) : (
        <>
          {!gpu.f16 && <p className="text-[13px] text-muted-foreground">{s.browser.f32}</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {catalog.browser.models.map((b) => {
              const added = existing.some((p) => p.kind === "BROWSER" && p.model === b.id);
              const gb = ((gpu.f16 ? b.vramMb : b.fallbackVramMb) / 1024).toFixed(1);
              return (
                <li key={b.id} className="flex flex-col gap-2 rounded-2xl bg-foreground/5 p-3.5">
                  <span className="flex items-center gap-2 text-[14.5px] font-medium text-foreground">
                    {b.label}
                    {b.recommended && (
                      <span className="rounded-full bg-brand-orange-soft px-2 py-0.5 text-[11px] font-semibold">{s.browser.recommended}</span>
                    )}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">{format(s.browser.vram, { gb })}</span>
                  <Button
                    size="sm"
                    variant={added ? "outline" : "default"}
                    className="self-start rounded-full"
                    disabled={added || busy !== null}
                    onClick={() => void add(b.id, b.label)}
                  >
                    {busy === b.id ? <Loader2 className="animate-spin" /> : added ? <Check /> : null}
                    {added ? s.browser.added : s.browser.add}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </Card>
  );
}

function AddOllama({ catalog, onAdd }: { catalog: ProviderCatalogDto; onAdd: (r: CreateProviderRequest) => Promise<void> }) {
  const s = useMessages().providers;
  const o = s.ollama;
  const [os, setOs] = useState<"mac" | "windows" | "linux">("mac");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OLLAMA);
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The site origin Ollama must allow (FRONTEND.md §8.1).
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";

  const suggestion = catalog.ollamaSuggestions[0]?.tag ?? "qwen3.5:2b";
  const url = baseUrl.trim().replace(/\/+$/, "") || DEFAULT_OLLAMA;

  const connect = async () => {
    setBusy(true);
    setStatus(null);
    const r = await testOllama(url);
    setBusy(false);
    if (!r.ok) {
      setModels(null);
      setStatus({ ok: false, text: o.errors[r.failed as OllamaTestCode] });
      return;
    }
    setModels(r.models);
    setModel((cur) => (cur && r.models.includes(cur) ? cur : r.models[0]));
    setStatus({ ok: true, text: format(o.found, { count: r.models.length }) });
  };

  const add = async () => {
    if (!model) return;
    setBusy(true);
    try {
      await onAdd({ kind: "LOCAL_OLLAMA", name: (name.trim() || model).slice(0, 60), baseUrl: url, model });
      setModels(null);
      setName("");
      setStatus(null);
    } catch (e) {
      setStatus({ ok: false, text: format(s.error, { message: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={<Laptop className="size-5" />} title={s.add.ollama}>
      <h3 className="text-[15px] font-semibold text-foreground">{o.guideTitle}</h3>
      <ol className="flex flex-col gap-3 text-[14px] text-foreground">
        <Step n={1}>{o.steps.install}</Step>
        <Step n={2}>
          {o.steps.pull}
          <Command value={`ollama pull ${suggestion}`} />
        </Step>
        <Step n={3}>
          {o.steps.allow}
          <div className="flex gap-1" role="tablist">
            {(["mac", "windows", "linux"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={os === k}
                onClick={() => setOs(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12.5px] font-medium",
                  os === k ? "bg-foreground text-background" : "bg-foreground/8 text-muted-foreground hover:text-foreground",
                )}
              >
                {o.os[k]}
              </button>
            ))}
          </div>
          {os === "mac" && (
            <>
              <Command value={`launchctl setenv OLLAMA_ORIGINS "${origin}"`} />
              <span className="text-[13px] text-muted-foreground">{o.macAfter}</span>
            </>
          )}
          {os === "windows" && <span className="text-[13px] text-muted-foreground">{format(o.windows, { origin })}</span>}
          {os === "linux" && (
            <>
              <Command value="sudo systemctl edit ollama.service" />
              <span className="text-[13px] text-muted-foreground">{o.linuxAfter}</span>
              <Command value={`Environment="OLLAMA_ORIGINS=${origin}"`} />
              <Command value="sudo systemctl daemon-reload && sudo systemctl restart ollama" />
            </>
          )}
          <span className="text-[13px] text-muted-foreground">{o.otherOrigins}</span>
          <span className="text-[13px] font-medium text-foreground">{o.neverStar}</span>
        </Step>
        <Step n={4}>{o.steps.test}</Step>
        <Step n={5}>{o.steps.browser}</Step>
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
          {o.baseUrl}
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
        </label>
        <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => void connect()}>
          {busy && !models ? <Loader2 className="animate-spin" /> : null}
          {o.testConnection}
        </Button>
      </div>
      {status && <p className={cn("text-[13.5px]", status.ok ? "text-foreground" : "text-destructive")}>{status.text}</p>}

      {models && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
            {o.pickModel}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-[14px] text-foreground"
            >
              {models.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
            {o.name}
            <Input value={name} placeholder={model} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button className="rounded-full" disabled={busy || !model} onClick={() => void add()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {o.add}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-primary-fill flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </li>
  );
}

/** A terminal command with a copy button (any command, unlike CopyCommand which only handles `ollama …`). */
function Command({ value }: { value: string }) {
  const s = useMessages().providers;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-foreground/6 py-1.5 pr-1.5 pl-3">
      <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-foreground">{value}</code>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-full"
        aria-label={s.copy}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? s.copied : s.copy}
      </Button>
    </div>
  );
}
