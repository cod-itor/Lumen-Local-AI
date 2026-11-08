import type { Metadata } from "next";
import { Inter, Noto_Sans_Khmer, Roboto_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PerfTierAttribute } from "@/lib/performance";
import { localeBootScript } from "@/i18n/config";
import { LocaleSync } from "@/i18n/provider";
import { chatWidthBootScript } from "@/lib/chat-width";
import { cn } from "@/lib/utils";
import "./globals.css";

// Figma uses SF Pro (Apple's system font, can't be bundled). On Apple devices the
// system font is used; elsewhere Inter is the closest fallback.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Khmer text in the design (language switch: English / ខ្មែរ)
const notoKhmer = Noto_Sans_Khmer({
  variable: "--font-noto-khmer",
  subsets: ["khmer"],
  weight: ["400", "500", "600"],
});

// Code / equation blocks
const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lumen — Your private AI study partner",
  description:
    "Runs locally and speaks Khmer and English. Chat with sources, ask your own documents, create images and learn step by step.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", inter.variable, notoKhmer.variable, robotoMono.variable)}
    >
      <head>
        {/* Saved chat width, applied before paint (constant script, no user input). */}
        <script dangerouslySetInnerHTML={{ __html: chatWidthBootScript }} />
        {/* Saved language, applied before paint (constant script, no user input). */}
        <script dangerouslySetInnerHTML={{ __html: localeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <PerfTierAttribute />
        <LocaleSync />
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
