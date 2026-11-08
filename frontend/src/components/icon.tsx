import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a Figma-exported SVG from /public/icons as a CSS mask so the icon
 * takes `currentColor` and follows light/dark mode. The SVG file itself is
 * the untouched Figma export.
 *
 * Size defaults to the Figma frame size. Pass `size` to match the design slot.
 */
export function Icon({
  name,
  size = 20,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const url = `url(/icons/${name}.svg)`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        ...style,
      }}
    />
  );
}
