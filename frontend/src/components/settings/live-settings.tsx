"use client";

import Link from "next/link";
import { ArrowRight, Check, Gauge, Laptop, LogOut, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import { api } from "@/lib/api";
import { initialsOf, modelLabel } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { MeResponse, OutputLanguage, ProviderDto, SettingsDto, SystemStatusDto } from "@/types/api";

/** The signed-in user (GET /api/auth/me) and a real log out (POST /api/auth/logout). */
export function AccountCard() {
  const s = useMessages().settings.account;
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<MeResponse>("/api/auth/me")
      .then((m) => alive && setMe(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const logOut = async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    // Full reload on purpose: nothing of the old session stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  };

  return (
    <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
      <span className="bg-brand-gradient flex size-11 items-center justify-center rounded-full text-[14px] font-semibold text-white">
        {me ? initialsOf(me.user.name) : "…"}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold text-foreground">{me ? me.user.name : s.loading}</span>
        {me && <span className="truncate text-[13.5px] text-muted-foreground">{me.user.email}</span>}
      </div>
      <button type="button" onClick={() => void logOut()} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
        <LogOut /> {s.logOut}
      </button>
    </div>
  );
}

/** The user's models (providers) with "Use this", plus which helper models are installed on this computer. */
export function YourModels() {
  const s = useMessages().settings.yourModels;
  const [providers, setProviders] = useState<ProviderDto[] | null>(null);
  const [status, setStatus] = useState<SystemStatusDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [p, st] = await Promise.all([
        api.get<ProviderDto[]>("/api/providers"),
        api.get<SystemStatusDto>("/api/system/status").catch(() => null),
      ]);
      setProviders(p);
      setStatus(st);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get<ProviderDto[]>("/api/providers"), api.get<SystemStatusDto>("/api/system/status").catch(() => null)])
      .then(([p, st]) => {
        if (!alive) return;
        setProviders(p);
        setStatus(st);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const use = async (p: ProviderDto) => {
    setSwitching(p.id);
    try {
      await api.post<ProviderDto>(`/api/providers/${p.id}/default`);
      setProviders((list) => list?.map((x) => ({ ...x, isDefault: x.id === p.id })) ?? list);
    } catch {
      await load();
    } finally {
      setSwitching(null);
    }
  };

  const inUse = providers?.find((p) => p.isDefault) ?? providers?.[0];
  const f = status?.ai.features;
  const helpers = f
    ? ([
        ["translation", f.translation],
        ["voice", f.voice],
        ["webSearch", f.webSearch],
        ["bgRemoval", f.bgRemoval],
        ["images", f.images],
      ] as const)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="glass overflow-hidden rounded-3xl">
        {failed ? (
          <div className="flex items-center gap-3 p-5 text-[14px] text-muted-foreground">
            {s.loadFailed}
            <button type="button" onClick={() => void load()} className="font-medium text-foreground underline">
              {s.retry}
            </button>
          </div>
        ) : providers === null ? (
          <div className="h-[76px] animate-pulse bg-foreground/5" />
        ) : providers.length === 0 ? (
          <p className="p-5 text-[14px] text-muted-foreground">{s.empty}</p>
        ) : (
          <ul role="radiogroup" aria-label={s.title} className="divide-y divide-border">
            {providers.map((p) => {
              const on = p.id === inUse?.id;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 sm:px-5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
                    <Laptop className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium text-foreground">{modelLabel(p)}</span>
                    <span className="truncate text-[12.5px] text-muted-foreground">
                      {s.kinds[p.kind]} · <span className="font-mono">{p.model}</span>
                    </span>
                  </div>
                  {on ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1.5 text-[13px] font-medium text-success-foreground">
                      <Check className="size-3.5" /> {s.inUse}
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={false}
                      disabled={switching !== null}
                      onClick={() => void use(p)}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                    >
                      {switching === p.id ? "…" : s.use}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/settings/models" className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-foreground/5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
            <Plus className="size-4" />
          </span>
          <span className="flex-1 text-[15px] font-medium text-foreground">{s.manage}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
        <Link href="/test" className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-foreground/5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/8 text-foreground">
            <Gauge className="size-4" />
          </span>
          <span className="flex-1 text-[15px] font-medium text-foreground">{s.test}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      </div>

      {helpers.length > 0 && (
        <div className="glass flex flex-col gap-3 rounded-3xl p-5">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-foreground">{s.helpers}</span>
            <span className="text-[13.5px] text-muted-foreground">{s.helpersHint}</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {helpers.map(([key, ready]) => (
              <li key={key} className="flex items-center justify-between gap-3 rounded-2xl bg-foreground/5 px-3.5 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-medium text-foreground">{s.helperItems[key]}</span>
                  {key === "images" && !ready && <span className="font-mono text-[12px] text-muted-foreground">{s.imagesHint}</span>}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium",
                    ready ? "bg-success/15 text-success-foreground" : "bg-foreground/8 text-muted-foreground",
                  )}
                >
                  {ready ? s.ready : s.notInstalled}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** SettingsDto.outputLanguage: English, Khmer (translated from English) or both side by side. */
export function AnswerLanguage() {
  const s = useMessages().settings.language;
  const [value, setValue] = useState<OutputLanguage | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<SettingsDto>("/api/settings")
      .then((x) => alive && setValue(x.outputLanguage))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const pick = async (next: OutputLanguage) => {
    const prev = value;
    setValue(next);
    try {
      const x = await api.patch<SettingsDto>("/api/settings", { outputLanguage: next });
      setValue(x.outputLanguage);
    } catch {
      setValue(prev);
    }
  };

  return (
    <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-foreground">{s.answer}</span>
        <span className="text-[13.5px] text-muted-foreground">{s.answerHint}</span>
      </div>
      <div role="radiogroup" aria-label={s.answer} className="flex gap-1 rounded-full bg-foreground/5 p-1">
        {(["EN", "KM", "BOTH"] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            disabled={value === null}
            onClick={() => void pick(o)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors disabled:opacity-40",
              value === o ? "bg-surface-raised text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.answerOptions[o]}
          </button>
        ))}
      </div>
    </div>
  );
}
