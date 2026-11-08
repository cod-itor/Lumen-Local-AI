"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useMessages, useTranslate } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LearningPathDto, PageResponse } from "@/types/api";
import { LearnPath } from "./learn-path";

const EASE = [0.22, 1, 0.36, 1] as const;

/** The Learn tab (FRONTEND.md §7.6): your paths, a new goal, and the open path. */
export function LearnHome() {
  const m = useMessages().app.learn.live;
  const t = useTranslate();
  const [paths, setPaths] = useState<LearningPathDto[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<{ text: string; support: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<PageResponse<LearningPathDto>>("/api/learning-paths?size=50")
      .catch(() => null)
      .then((page) => {
        if (!alive) return;
        const items = page?.items ?? [];
        setPaths(items);
        const fromUrl = new URLSearchParams(window.location.search).get("path");
        const pick = items.find((x) => x.id === fromUrl) ?? items.find((x) => x.state !== "COMPLETED");
        if (pick) setOpenId(pick.id);
      });
    return () => {
      alive = false;
    };
  }, []);

  const open = (id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("path", id);
    else url.searchParams.delete("path");
    window.history.replaceState(null, "", url);
  };

  const create = async () => {
    const g = goal.trim();
    if (g.length < 3 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const p = await api.post<LearningPathDto>("/api/learning-paths", { goal: g });
      setGoal("");
      setPaths((list) => [p, ...(list ?? [])]);
      open(p.id);
    } catch (e) {
      if (e instanceof ApiError && e.code === "GUARD_BLOCKED") {
        const d = (e.details ?? {}) as { action?: string; refusal?: string };
        setError({ text: d.refusal || e.message, support: d.action === "SUPPORT" });
      } else setError({ text: e instanceof ApiError ? e.message : m.failed, support: false });
    } finally {
      setCreating(false);
    }
  };

  const onChange = (p: LearningPathDto | null, removedId?: string) => {
    setPaths((list) => {
      const rest = (list ?? []).filter((x) => x.id !== (p?.id ?? removedId));
      return p ? [p, ...rest] : rest;
    });
    if (!p) open(null);
  };

  const current = paths?.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex h-full min-h-0 gap-4 pl-4 max-sm:flex-col max-sm:px-4">
      <aside className="flex w-[260px] shrink-0 flex-col gap-3 pt-1 max-sm:w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="glass flex flex-col gap-2 rounded-[20px] p-4"
        >
          <label htmlFor="learn-goal" className="text-[13px] font-semibold text-foreground">
            {m.newGoal}
          </label>
          <textarea
            id="learn-goal"
            value={goal}
            maxLength={200}
            rows={2}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void create();
              }
            }}
            placeholder={m.goalPlaceholder}
            className="resize-none rounded-[12px] border border-border bg-transparent px-3 py-2 text-[14px] text-foreground outline-none placeholder:text-placeholder focus:border-foreground/40"
          />
          <button
            type="submit"
            disabled={goal.trim().length < 3 || creating}
            className="bg-primary-fill rounded-[12px] px-4 py-[8px] text-[13.5px] font-medium transition-[filter] hover:brightness-110 disabled:opacity-40"
          >
            {creating ? m.creating : m.start}
          </button>
          {error && (
            <p
              role="alert"
              className={cn(
                "text-[12.5px] leading-[18px]",
                error.support ? "rounded-[12px] bg-surface-muted p-2.5 text-foreground" : "text-danger",
              )}
            >
              {error.text}
            </p>
          )}
        </form>

        {paths && paths.length > 0 && (
          <nav aria-label={m.yourPaths} className="flex flex-col gap-1">
            <span className="px-2 text-[11.5px] font-semibold tracking-[0.2px] text-subtle uppercase">{m.yourPaths}</span>
            {paths.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => open(p.id)}
                aria-current={p.id === openId ? "page" : undefined}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-accent",
                  p.id === openId && "bg-nav-active shadow-soft",
                )}
              >
                <span className="line-clamp-1 text-[13.5px] font-medium text-foreground">{p.plan?.title ?? p.goal}</span>
                <span className="text-[11.5px] text-muted-foreground">
                  {p.state === "ACTIVE" || p.state === "COMPLETED"
                    ? t("app.learn.live.progress", { done: String(p.progress.done), total: String(p.progress.total) })
                    : m.states[p.state]}
                </span>
              </button>
            ))}
          </nav>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {current ? (
          <LearnPath key={current.id} initial={current} onChange={onChange} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="mx-auto flex max-w-[460px] flex-1 flex-col items-center justify-center gap-2 px-4 text-center"
          >
            <h1 className="text-[22px] font-semibold text-foreground">{m.emptyTitle}</h1>
            <p className="text-[14px] leading-[21px] text-muted-foreground">{m.emptyBody}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
