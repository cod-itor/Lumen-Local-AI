"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { AppSection } from "@/types";
import { SidebarClosedControls } from "./sidebar";

const TABS = [
  { href: "/chat", label: "Chat", icon: "msg", match: ["chat", "learn"] },
  { href: "/documents", label: "Documents", icon: "file", match: ["documents"] },
  { href: "/image", label: "Image", icon: "image", match: ["image"] },
] as const;

/** Header row: sidebar-closed controls + model picker (left), centered tab bar. */
export function TopBar({ section, model }: { section: AppSection; model: string | null }) {
  return (
    <header className="relative flex h-16 shrink-0 items-start">
      <div className="flex items-center gap-[10px] pt-[2px]">
        <SidebarClosedControls />
        <AnimatePresence mode="popLayout" initial={false}>
          {model && (
            <motion.button
              key={model}
              layout
              type="button"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="mt-[7px] ml-1 flex items-center gap-[5px] rounded-[12px] px-[10px] py-[6px] transition-colors hover:bg-accent"
            >
              <span className="text-[15px] font-semibold whitespace-nowrap text-foreground">{model}</span>
              <Icon name="chev" size={14} className="text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <nav
        aria-label="Workspace"
        className="glass absolute top-[2px] left-1/2 flex -translate-x-1/2 items-start gap-[2px] rounded-[16px] p-1"
      >
        {TABS.map((tab) => {
          const active = (tab.match as readonly string[]).includes(section);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-[7px] rounded-[12px] px-4 py-[9px] transition-colors",
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
              <span className="relative text-[13.5px] font-medium whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
