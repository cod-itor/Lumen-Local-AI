import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Teach tailwind-merge the Figma type scale from globals.css (`--text-*`), so
 * `cn("text-caption", "text-muted-foreground")` keeps both instead of treating
 * the size as a conflicting text color.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "h1",
        "h2",
        "h3",
        "title",
        "lead",
        "body-lg",
        "body",
        "callout",
        "footnote",
        "caption",
        "caption-sm",
        "micro",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
