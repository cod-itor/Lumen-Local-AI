"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const MODES = [
  { href: "/login", id: "login" },
  { href: "/signup", id: "signup" },
] as const;

/**
 * Log in / Sign up pill switch. Rendered by the (auth) layout so it stays
 * mounted and the active pill glides between the two pages.
 */
export function ModeSwitch() {
  const pathname = usePathname();
  const m = useMessages();
  const active = MODES.find((mode) => mode.href === pathname)?.href;
  return (
    // Always rendered (hidden on other steps) so the card below never shifts.
    <nav
      aria-label={m.auth.modes.aria}
      aria-hidden={!active}
      inert={!active}
      className={cn(
        "glass mx-auto mb-4 short:mb-3 flex w-fit shrink-0 rounded-full p-1 transition-opacity duration-200",
        !active && "pointer-events-none opacity-0",
      )}
    >
      {MODES.map((mode) => {
        const on = mode.href === active;
        return (
          <Link
            key={mode.href}
            href={mode.href}
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
            <span className="relative">{m.auth.modes[mode.id]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
