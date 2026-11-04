"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { LandingContent, LandingLanguage } from "@/types/landing";
import { EASE } from "./motion";
import { Magnetic } from "./pointer-effects";
import { GlassChip } from "./primitives";
import { TypeOnce } from "./typewriter";
import { scrollToHash } from "./top-nav";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export function Hero({ hero }: { hero: LandingContent["hero"] }) {
  const [language, setLanguage] = useState<LandingLanguage["id"]>("en");

  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="show"
      className="relative flex flex-col items-center gap-6 px-4 pt-16 pb-12 text-center sm:pt-[88px] sm:pb-16"
    >
      <motion.div variants={item}>
        <GlassChip className="gap-1.5 px-3.5 py-2 text-[13px] leading-[normal] font-medium">
          <span className="size-2 rounded-full bg-success" />
          {hero.badge}
        </GlassChip>
      </motion.div>

      <motion.h1
        variants={item}
        className="text-[44px] leading-[48px] font-semibold tracking-[-1.6px] text-foreground sm:text-[62px] sm:leading-[66px] lg:text-display lg:leading-[80px] lg:tracking-[-2.66px]"
      >
        <TypeOnce text={hero.title[0]} delayMs={300} />
        <br />
        <TypeOnce text={hero.title[1]} delayMs={300 + hero.title[0].length * 38 + 120} />
      </motion.h1>

      <motion.p variants={item} className="max-w-[640px] text-[17px] leading-[26px] text-muted-foreground sm:text-[19px] sm:leading-[29px]">
        {hero.subtitle}
      </motion.p>

      <motion.div variants={item} className="flex flex-col items-center gap-3 pt-2 sm:flex-row">
        <Magnetic>
          <Link
            href={hero.primaryCta.href}
            className="bg-primary-fill inline-flex items-center gap-1.5 rounded-full px-[26px] py-4 text-base leading-[normal] font-medium transition-transform hover:-translate-y-0.5"
          >
            {hero.primaryCta.label}
            <Icon name="landing-arrow" size={17} />
          </Link>
        </Magnetic>
        <a
          href={hero.secondaryCta.href}
          onClick={(e) => scrollToHash(e, hero.secondaryCta.href)}
          className="glass inline-flex items-center gap-1.5 rounded-full px-6 py-4 text-base leading-[normal] font-medium text-foreground transition-transform hover:-translate-y-0.5"
        >
          {hero.secondaryCta.icon && <Icon name={hero.secondaryCta.icon} size={14} />}
          {hero.secondaryCta.label}
        </a>
      </motion.div>

      <motion.div variants={item} className="flex items-center gap-2 pt-1">
        <span className="text-[13px] leading-[normal] text-muted-foreground">{hero.languagesLabel}</span>
        <div role="radiogroup" aria-label={hero.languagesLabel} className="flex items-center gap-2">
          {hero.languages.map((l) => {
            const selected = l.id === language;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={selected}
                lang={l.lang}
                onClick={() => setLanguage(l.id)}
                className={cn(
                  "glass rounded-full px-3 py-[5px] text-[12.5px] leading-[normal] font-medium text-foreground transition-opacity",
                  selected ? "ring-1 ring-foreground/25" : "opacity-80 hover:opacity-100",
                )}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.section>
  );
}
