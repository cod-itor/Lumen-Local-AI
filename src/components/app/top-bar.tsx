"use client";

import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { AppSection } from "@/types";
import { useShell } from "./shell-context";
import { SidebarClosedControls } from "./sidebar";

const MotionLink = motion.create(Link);

const TABS = [
  { key: "chat", icon: "msg", match: ["chat", "learn"] },
  { key: "documents", icon: "file", match: ["documents"] },
  { key: "image", icon: "image", match: ["image"] },
] as const;

/**
 * Header row: sidebar-closed controls + model picker (left), tab bar centered
 * over the full header width so it never moves between pages.
 */
export function TopBar({
  section,
  model,
  tabHomes,
}: {
  section: AppSection;
  model: string | null;
  tabHomes: { chat: string; documents: string; image: string };
}) {
  const { lastPaths } = useShell();
  const msgs = useMessages();
  const m = msgs.app.topBar;

  return (
    <header className="relative flex h-14 shrink-0 items-start sm:h-16">
      <div className="flex min-w-0 items-center gap-[10px] pt-[2px]">
        <SidebarClosedControls />
        {/* Fixed-width slot so the picker appearing/disappearing never shifts anything. */}
        <div className="hidden h-[44px] items-center md:flex">
          <AnimatePresence mode="wait" initial={false}>
            {model && (
              <MotionLink
                key={model}
                href="/settings#models"
                title={m.modelHint}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="ml-1 flex items-center gap-[5px] rounded-[12px] px-[10px] py-[6px] transition-colors hover:bg-accent"
              >
                <span className="text-[15px] font-semibold whitespace-nowrap text-foreground">
                  {model}
                </span>
                <Icon name="chev" size={14} className="text-muted-foreground" />
              </MotionLink>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav
        aria-label={m.workspace}
        className="glass absolute top-[2px] right-0 flex items-start gap-[2px] rounded-[16px] p-1 sm:right-auto sm:left-1/2 sm:-translate-x-1/2"
      >
        {TABS.map((tab) => {
          const active = (tab.match as readonly string[]).includes(section);
          const href = lastPaths[tab.key] ?? tabHomes[tab.key];
          const label = m[tab.key];
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "relative flex items-center gap-[7px] rounded-[12px] px-3 py-[9px] transition-colors sm:px-4",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  className="absolute inset-0 rounded-[12px] bg-surface-raised shadow-soft"
                />
              )}
              <Icon name={tab.icon} size={15} className="relative" />
              <span className="relative hidden text-[13.5px] font-medium whitespace-nowrap sm:inline">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Top-right: planned features. Icon-only on phones, beside the tabs. */}
      <Link
        href="/coming-soon"
        aria-label={msgs.common.comingSoonAria}
        className="glass group absolute top-[2px] right-[140px] flex h-[44px] items-center gap-2 rounded-[16px] px-3 text-foreground transition-transform hover:-translate-y-px sm:right-0 sm:px-3.5"
      >
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-orange/70 [animation-duration:2s]" />
          <span className="relative size-2 rounded-full bg-brand-orange" />
        </span>
        <Sparkles className="size-4 sm:hidden" strokeWidth={1.8} />
        <span className="hidden text-[13px] font-medium whitespace-nowrap sm:inline">{msgs.common.comingSoon}</span>
      </Link>
    </header>
  );
}
