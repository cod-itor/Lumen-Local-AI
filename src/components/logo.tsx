import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Lumen mark: a rounded tile in the brand gradient (blue → orange, the two
 * glows of the UI) with a four-point "spark of understanding" and a small
 * companion spark. Same artwork as /app/icon.svg (the browser tab icon).
 */
export function LumenMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={`lm-bg-${id}`} x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6FA6E6" />
          <stop offset="0.55" stopColor="#B7A6C9" />
          <stop offset="1" stopColor="#F08A3C" />
        </linearGradient>
        <radialGradient id={`lm-hl-${id}`} cx="0" cy="0" r="1" gradientTransform="translate(10 7) rotate(50) scale(20)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill={`url(#lm-bg-${id})`} />
      <rect width="32" height="32" rx="9.5" fill={`url(#lm-hl-${id})`} />
      <path
        d="M15 7.5c.55 4.6 2.9 6.95 7.5 7.5-4.6.55-6.95 2.9-7.5 7.5-.55-4.6-2.9-6.95-7.5-7.5 4.6-.55 6.95-2.9 7.5-7.5Z"
        fill="#fff"
      />
      <path d="M22.6 18.4c.22 1.75 1.1 2.63 2.85 2.85-1.75.22-2.63 1.1-2.85 2.85-.22-1.75-1.1-2.63-2.85-2.85 1.75-.22 2.63-1.1 2.85-2.85Z" fill="#fff" fillOpacity="0.85" />
    </svg>
  );
}

/** Mark + wordmark. */
export function LumenLogo({ size = 28, className, textClassName }: { size?: number; className?: string; textClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LumenMark size={size} />
      <span className={cn("text-[19px] leading-[normal] font-semibold tracking-[-0.3px] text-foreground", textClassName)}>
        Lumen
      </span>
    </span>
  );
}
