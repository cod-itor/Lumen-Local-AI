"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Composer } from "@/components/app/composer";
import { useLocale, useMessages } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { setPendingPrompt } from "@/lib/harness/pending";
import { useSession } from "@/lib/session";
import type { Suggestion } from "@/types";
import type { ChatDto } from "@/types/api";

/** Figma "01 · Chat · New": centered title, composer, suggestion chips. */
export function NewChat({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const m = useMessages().app.chat;
  const locale = useLocale();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New chat = POST /api/chats, then the chat page sends the first message (FRONTEND.md §7.2).
  const open = async (text: string, webSearch = false) => {
    if (creating) return;
    if (!session.provider) {
      setError(m.live.noModel);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const chat = await api.post<ChatDto>("/api/chats", { tab: "CHAT" });
      session.touchChat(chat);
      setPendingPrompt(chat.id, text, webSearch);
      router.push(`/chat/${chat.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.live.loadFailed);
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center pt-[238px] max-[860px]:pt-[18vh]">
      <h1 className="px-4 text-center text-[30px] font-semibold tracking-[-0.9px] text-balance text-foreground">
        {m.heading}
      </h1>
      <div className="mt-[22px] w-full max-w-[calc(var(--chat-width)+20px)]">
        <Composer defaultSearchOn={false} busy={creating} onSubmit={(text, o) => void open(text, o.webSearch)} />
        {error && <p className="mt-3 text-center text-[13px] text-muted-foreground">{error}</p>}
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
              onClick={() => void open(s.label[locale])}
              className="rounded-full border border-border px-[14px] py-2 text-[13px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
            >
              {s.label[locale]}
            </button>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
