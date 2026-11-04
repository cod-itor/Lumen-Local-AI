"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Dark by default (per request). Users can still switch with <ThemeToggle />. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
