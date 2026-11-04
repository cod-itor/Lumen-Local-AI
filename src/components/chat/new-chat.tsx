"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/app/composer";
import type { Suggestion } from "@/types";

/** Figma "01 · Chat · New": centered title, composer, suggestion chips. */
export function NewChat({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  // Static prototype: any prompt opens the sample answer (02 · Chat · Answer).
  const open = () => router.push("/chat/photosynthesis");

  return (
    <div className="flex h-full flex-col items-center pt-[238px] max-[860px]:pt-[18vh]">
      <h1 className="text-[30px] font-semibold tracking-[-0.9px] whitespace-nowrap text-foreground">
        What should we learn today?
      </h1>
      <div className="mt-[22px] w-full max-w-[calc(var(--chat-width)+20px)]">
        <Composer onSubmit={open} />
      </div>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
        className="mt-4 flex flex-wrap justify-center gap-2"
      >
        {suggestions.map((s) => (
          <motion.li
            key={s.id}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
          >
            <button
              type="button"
              onClick={open}
              className="rounded-full border border-border px-[14px] py-2 text-[13px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
            >
              {s.label}
            </button>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
