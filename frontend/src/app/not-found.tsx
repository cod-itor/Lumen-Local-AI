"use client";

import Link from "next/link";
import { Logo } from "@/components/landing/top-nav";
import { buttonVariants } from "@/components/ui/button";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Any unknown URL. The button goes to "/": the route guard (proxy.ts) sends a signed-in user on to /chat
 * and a visitor to the landing page, so nobody looks signed out just because they mistyped a path.
 */
export default function NotFound() {
  const m = useMessages().common.notFound;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-4 text-center">
      <Logo />
      <h1 className="text-[22px] font-semibold text-foreground">{m.title}</h1>
      <p className="max-w-sm text-[14.5px] text-muted-foreground">{m.body}</p>
      <Link href="/" className={cn(buttonVariants(), "rounded-full")}>
        {m.back}
      </Link>
    </main>
  );
}
