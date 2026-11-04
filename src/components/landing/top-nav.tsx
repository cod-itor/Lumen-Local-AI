"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState, type MouseEvent } from "react";
import { Icon } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";
import type { LandingLink } from "@/types/landing";
import { EASE } from "./motion";

/** Smooth-scroll to an in-page anchor; falls through for normal links. */
export function scrollToHash(e: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("#")) return;
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", href);
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className ?? "flex items-center gap-2"}>
      <Icon name="spark" size={20} className="text-foreground" />
      <span className="text-[19px] leading-[normal] font-semibold tracking-[-0.19px] text-foreground">Lumen</span>
    </span>
  );
}

export function TopNav({ links }: { links: LandingLink[] }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));

  return (
    <header className="pointer-events-none sticky top-0 z-50 px-4 pt-4 sm:px-8 sm:pt-6 xl:px-0">
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="glass pointer-events-auto relative mx-auto flex h-14 max-w-[1280px] items-center justify-between rounded-xl pr-2.5 pl-5 sm:h-16 sm:pl-6"
      >
        {/* Extra lift once the page scrolls (opacity-only transition). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-device transition-opacity duration-300"
          style={{ opacity: scrolled ? 1 : 0 }}
        />
        <Link href="/" aria-label="Lumen home" className="relative">
          <Logo />
        </Link>

        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                onClick={(e) => scrollToHash(e, l.href)}
                className="text-[14.5px] leading-[normal] font-medium text-foreground-tertiary transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="relative flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-3 text-[14.5px] leading-[normal] font-medium text-foreground transition-colors hover:bg-accent sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-primary-fill inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14.5px] leading-[normal] font-medium transition-transform hover:-translate-y-px sm:px-5 sm:py-3"
          >
            Get started
            <Icon name="landing-arrow" size={15} />
          </Link>
        </div>
      </motion.nav>
    </header>
  );
}
