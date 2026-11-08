import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Figma "Chip" — glass pill. */
export function GlassChip({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "glass inline-flex items-center justify-center rounded-full whitespace-nowrap text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Small uppercase section label ("FEATURES", "HOW IT WORKS"…). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <GlassChip className="px-3 py-1.5 text-[11.5px] leading-[normal] font-semibold">{children}</GlassChip>;
}

/** Section heading (Figma 50px Semibold, -1.25 tracking). */
export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-center text-[34px] leading-[1.15] font-semibold tracking-[-1px] text-foreground sm:text-[42px] lg:text-[50px] lg:leading-[1.2] lg:tracking-[-1.25px]",
        className,
      )}
      {...props}
    />
  );
}

/** Content container: 1280 wide on desktop, gutters below. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1280px]", className)} {...props} />;
}
