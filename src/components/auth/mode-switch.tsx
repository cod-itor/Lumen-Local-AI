"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MODES = [
  { href: "/login", label: "Log in" },
  { href: "/signup", label: "Sign up" },
] as const;

/**
 * Log in / Sign up pill switch. Rendered by the (auth) layout so it stays
 * mounted and the active pill glides between the two pages.
 */
export function ModeSwitch() {
  const pathname = usePathname();
  const active = MODES.find((m) => m.href === pathname)?.href;
  return (
    <AnimatePresence initial={false}>
      {active && (
        <motion.nav
          key="mode-switch"
          aria-label="Account"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="glass mx-auto mb-4 flex w-fit rounded-full p-1"
        >
      {MODES.map((m) => {
        const on = m.href === active;
        return (
          <Link
            key={m.href}
            href={m.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative rounded-full px-5 py-2 text-[14px] leading-none font-medium transition-colors",
              on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId="auth-mode-pill"
                className="bg-primary-fill absolute inset-0 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{m.label}</span>
          </Link>
        );
      })}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
