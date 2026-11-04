"use client";

import { Check, ChevronDown, Link2 } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { InstalledModel, ModelRole, ModelState } from "@/types/settings";
import { CopyCommand } from "./copy-command";
import { SettingsIcon } from "./icons";

const STATE: Record<ModelState, { label: string; className: string; dot: string }> = {
  ready: { label: "Ready", className: "bg-success/15 text-success-foreground", dot: "bg-success" },
  downloading: { label: "Downloading", className: "bg-brand-blue-soft text-foreground", dot: "bg-brand-blue" },
  missing: { label: "Not installed", className: "bg-danger/12 text-danger", dot: "bg-danger" },
};

export function StatePill({ state, progress }: { state: ModelState; progress?: number }) {
  const s = STATE[state];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", s.className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
      {state === "downloading" && progress !== undefined && ` · ${progress}%`}
    </span>
  );
}

/**
 * One card per AI job (chat, documents, images): what it does, which
 * installed model does it, what that model must support, and the tools or
 * pipeline around it. Assignments are local UI state for now.
 */
export function ModelRoles({ roles, installed }: { roles: ModelRole[]; installed: InstalledModel[] }) {
  const [assigned, setAssigned] = useState<Record<string, string>>(() =>
    Object.fromEntries(roles.flatMap((r) => r.slots.map((s) => [`${r.id}:${s.label}`, s.modelId]))),
  );
  const chatModel = assigned[`chat:${roles.find((r) => r.id === "chat")?.slots[0]?.label}`];
  const find = (id: string) => installed.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-5">
      {roles.map((role) => {
        const slotModels = role.slots.map((s) => {
          // The documents "answer" slot always uses the Learning & chat model.
          const linked = role.id !== "chat" && s.accepts === "chat";
          const id = linked ? chatModel : assigned[`${role.id}:${s.label}`];
          return { slot: s, linked, model: find(id) };
        });
        const state: ModelState = slotModels.some((m) => !m.model || m.model.state === "missing")
          ? "missing"
          : slotModels.some((m) => m.model?.state === "downloading")
            ? "downloading"
            : "ready";

        return (
          <article key={role.id} id={`role-${role.id}`} className="glass flex flex-col gap-5 rounded-3xl p-5 sm:p-6">
            <header className="flex items-start gap-4">
              <span className="bg-primary-fill flex size-11 shrink-0 items-center justify-center rounded-2xl">
                <SettingsIcon name={role.icon} className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[18px] font-semibold text-foreground">{role.title}</h3>
                  <StatePill state={state} />
                </div>
                <p className="text-[15px] leading-[22px] text-foreground-secondary">{role.job}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[12.5px] text-muted-foreground">Used in</span>
                  {role.usedIn.map((u) => (
                    <span key={u} className="rounded-full bg-foreground/8 px-2 py-0.5 text-[12px] font-medium text-foreground">
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            {/* Which model does this job */}
            <div className="flex flex-col gap-2">
              {slotModels.map(({ slot, linked, model }) => {
                const key = `${role.id}:${slot.label}`;
                const options = installed.filter((m) => m.role === slot.accepts);
                return (
                  <div key={key} className="flex flex-col gap-3 rounded-2xl bg-foreground/5 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[14px] font-semibold text-foreground">{slot.label}</span>
                      <span className="text-[13px] text-muted-foreground">{slot.why}</span>
                    </div>
                    {linked ? (
                      <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-[13.5px] text-foreground">
                        <Link2 className="size-4 text-muted-foreground" />
                        {model?.name ?? "—"}
                        <span className="text-[12px] text-muted-foreground">from Learning & chat</span>
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`${slot.label} for ${role.title}`}
                          className="glass inline-flex min-w-[220px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent data-[popup-open]:bg-accent"
                        >
                          <span className="flex flex-col">
                            <span className="text-[14px] font-medium text-foreground">{model?.name ?? "Choose a model"}</span>
                            <span className="font-mono text-[11.5px] text-muted-foreground">
                              {model ? `${model.id} · ${model.size}` : "None installed"}
                            </span>
                          </span>
                          <ChevronDown className="size-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Installed on this computer</DropdownMenuLabel>
                            <DropdownMenuRadioGroup
                              value={assigned[key]}
                              onValueChange={(v) => setAssigned((a) => ({ ...a, [key]: String(v) }))}
                            >
                              {options.map((m) => (
                                <DropdownMenuRadioItem key={m.id} value={m.id} disabled={m.state !== "ready"}>
                                  <span className="flex flex-col">
                                    <span>{m.name}</span>
                                    <span className="text-[11.5px] text-muted-foreground">
                                      {m.state === "ready" ? `${m.size} · ${m.capabilities.join(" · ")}` : `Downloading · ${m.progress ?? 0}%`}
                                    </span>
                                  </span>
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">The model must</h4>
                <ul className="flex flex-col gap-2">
                  {role.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-[14px] text-foreground">
                      <Check className="mt-[3px] size-3.5 shrink-0 text-success" strokeWidth={2.6} />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {role.tools && (
                <div className="flex flex-col gap-2.5">
                  <h4 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Tools it can call</h4>
                  <ul className="flex flex-col gap-2">
                    {role.tools.map((t) => (
                      <li key={t.name} className="flex flex-col text-[14px]">
                        <span className="font-medium text-foreground">{t.name}</span>
                        <span className="text-[13px] text-muted-foreground">{t.when}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {role.pipeline && (
                <div className="flex flex-col gap-2.5">
                  <h4 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">How a question is answered</h4>
                  <ol className="flex flex-col gap-2">
                    {role.pipeline.map((p, i) => (
                      <li key={p} className="flex items-center gap-2.5 text-[14px] text-foreground">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold">
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="grid gap-5 border-t border-border pt-5 md:grid-cols-2">
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Install</h4>
                {role.install.map((c) => (
                  <CopyCommand key={c} value={c} />
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Other models that work</h4>
                <ul className="flex flex-col gap-1.5">
                  {role.alternatives.map((a) => (
                    <li key={a.name} className="text-[14px]">
                      <span className="font-medium text-foreground">{a.name}</span>
                      <span className="text-muted-foreground"> — {a.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
