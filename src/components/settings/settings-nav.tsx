"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type SettingsNavItem = { id: string; label: string };

/**
 * Section navigation: a sticky list on desktop, a scrollable chip row on
 * phones. Highlights the section currently in view.
 */
export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const m = useMessages();

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label={m.settings.navAria} className="lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {items.map((item) => {
          const on = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={on ? "true" : undefined}
                onClick={() => setActive(item.id)}
                className={cn(
                  "relative flex items-center rounded-full px-3.5 py-2 text-[14px] font-medium whitespace-nowrap transition-colors lg:rounded-xl lg:whitespace-normal",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="settings-nav-pill"
                    className="absolute inset-0 rounded-[inherit] bg-surface-raised shadow-soft"
                    transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
