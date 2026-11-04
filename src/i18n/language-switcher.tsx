"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { LOCALE_LABEL, LOCALES } from "./config";
import { setLocale, useLocale, useMessages } from "./provider";

/** English / ខ្មែរ segmented switch. Changes every page instantly. */
export function LanguageSwitcher({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const locale = useLocale();
  const m = useMessages();
  const pill = useId();
  return (
    <div
      role="radiogroup"
      aria-label={m.common.language}
      className={cn("glass inline-flex shrink-0 rounded-full p-1", className)}
    >
      {LOCALES.map((l) => {
        const on = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={on}
            lang={l}
            onClick={() => setLocale(l)}
            className={cn(
              "relative rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-1.5 text-[13.5px]",
              on ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on && (
              <motion.span
                layoutId={`lang-pill-${pill}`}
                className="bg-primary-fill absolute inset-0 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{LOCALE_LABEL[l].native}</span>
          </button>
        );
      })}
    </div>
  );
}
