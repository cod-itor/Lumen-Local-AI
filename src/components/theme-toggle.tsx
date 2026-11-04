"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex size-[30px] items-center justify-center rounded-full text-icon transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <Sun className="hidden size-4 dark:block" strokeWidth={1.6} />
      <Moon className="size-4 dark:hidden" strokeWidth={1.6} />
    </button>
  );
}
