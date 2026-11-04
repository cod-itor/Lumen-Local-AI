"use client";

import { motion, type Variants } from "motion/react";
import { Icon } from "@/components/icon";
import { LumenMark } from "@/components/logo";
import { PreviewReply } from "@/components/chat/preview-reply";
import { EASE } from "@/components/landing/motion";
import { GlassChip } from "@/components/landing/primitives";
import { TypewriterLoop } from "@/components/landing/typewriter";
import type { Localized } from "@/i18n/config";
import { useLocale, useLocalized, useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { AuthBrandContent } from "@/types/auth";

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * Desktop-only story beside the auth forms: the landing hero's voice, glass
 * and typewriter, plus a tiny live chat so the product is felt, not described.
 */
export function BrandPanel({ content: bundle, className }: { content: Localized<AuthBrandContent>; className?: string }) {
  const content = useLocalized(bundle);
  const locale = useLocale();
  const m = useMessages();
  return (
    <motion.section
      variants={list}
      initial="hidden"
      animate="show"
      aria-label={m.auth.aboutLumen}
      className={cn("flex-col gap-8", className)}
    >
      <motion.div variants={item}>
        <GlassChip className="gap-1.5 px-3.5 py-2 text-[13px] leading-[normal] font-medium">
          <span className="size-2 rounded-full bg-success" />
          {content.badge}
        </GlassChip>
      </motion.div>

      <motion.h1
        variants={item}
        className="text-[52px] leading-[58px] font-semibold tracking-[-1.8px] text-foreground xl:text-[60px] xl:leading-[66px]"
      >
        {content.headline}
        <br />
        {/* Keyed by language so the loop restarts cleanly when it changes. */}
        <TypewriterLoop key={locale} phrases={content.phrases} className="text-foreground-tertiary" />
      </motion.h1>

      <motion.p variants={item} className="max-w-[500px] text-[17px] leading-[26px] text-muted-foreground">
        {content.subtitle}
      </motion.p>

      {/* Mini chat: question bubble, then a locally-"streamed" answer. */}
      <motion.div variants={item} className="glass flex max-w-[500px] flex-col gap-4 rounded-2xl p-5" aria-hidden>
        <div className="bg-primary-fill self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[14px]">
          {content.preview.question}
        </div>
        <div className="flex gap-3">
          <LumenMark size={32} className="rounded-full" />
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <PreviewReply key={locale} text={content.preview.answer} thinkMs={1600} />
            <span className="text-[12px] text-subtle">{content.preview.model}</span>
          </div>
        </div>
      </motion.div>

      <motion.ul variants={list} className="grid max-w-[560px] grid-cols-3 gap-4">
        {content.points.map((p) => (
          <motion.li key={p.icon} variants={item} className="flex flex-col gap-2">
            <span className="glass flex size-9 items-center justify-center rounded-xl text-foreground">
              <Icon name={p.icon} size={17} />
            </span>
            <span className="text-[14px] font-semibold text-foreground">{p.title}</span>
            <span className="text-[13px] leading-[19px] text-muted-foreground">{p.body}</span>
          </motion.li>
        ))}
      </motion.ul>
    </motion.section>
  );
}
