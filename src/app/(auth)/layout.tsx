import Link from "next/link";
import type { ReactNode } from "react";
import { AuthFlowProvider } from "@/components/auth/auth-flow";
import { BrandPanel } from "@/components/auth/brand-panel";
import { ModeSwitch } from "@/components/auth/mode-switch";
import { Glow } from "@/components/landing/motion";
import { Logo } from "@/components/landing/top-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAuthBrandContent, getResendCooldownSec } from "@/services/auth";

/**
 * Shared frame for every auth step. Stays mounted between /login, /signup,
 * /forgot-password, /verify and /reset-password, so the brand panel, glows
 * and in-memory flow state persist; only the card (template) transitions.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const brand = await getAuthBrandContent();

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-x-clip">
      {/* Same brand glows as the landing hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <Glow tone="blue" className="top-[8%] left-[-6%] h-[460px] w-[520px]" blur={120} />
        <Glow tone="orange" className="right-[-8%] bottom-[-6%] h-[480px] w-[560px]" blur={120} duration={22} />
      </div>

      <header className="relative z-10 flex h-16 items-center justify-between px-4 sm:h-20 sm:px-8">
        <Link href="/" aria-label="Lumen home" className="rounded-md">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <AuthFlowProvider resendCooldownSec={getResendCooldownSec()}>
        <div className="relative mx-auto grid w-full max-w-[1280px] flex-1 items-center gap-16 px-4 pt-2 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:pb-16 xl:gap-24">
          <BrandPanel content={brand} className="hidden lg:flex" />
          <main className="mx-auto w-full max-w-[460px]">
            <ModeSwitch />
            {children}
          </main>
        </div>
      </AuthFlowProvider>

      <footer className="relative px-4 pb-6 text-center text-[12.5px] text-subtle sm:px-8">
        Lumen runs locally — your account details stay on this device.
      </footer>
    </div>
  );
}
