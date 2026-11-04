"use client";

import { motion } from "motion/react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Composer } from "@/components/app/composer";
import { ShellRightPanel } from "@/components/app/right-panel";
import type { ChatMessage, Conversation, Source } from "@/types/chat";
import { AssistantAnswer, riseItem } from "./assistant-answer";
import { SourcesPanel } from "./sources-panel";

/**
 * Figma "02 · Chat · Answer" / "03 · Chat · Sources open" / "04 · Chat · Sidebar closed + voice".
 * Thread + follow-up composer; the sources chip or an inline citation opens the
 * 320px sources panel on the right.
 */
export function ChatThread({ conversation }: { conversation: Conversation }) {
  const [messages, setMessages] = useState<ChatMessage[]>(conversation.messages);
  // `null` until the user toggles; until then follow the `?sources=open` deep link.
  const [sourcesToggled, setSourcesOpenState] = useState<boolean | null>(null);
  const deepLinkOpen = useSyncExternalStore(noopSubscribe, readSourcesParam, () => false);
  const sourcesOpen = sourcesToggled ?? deepLinkOpen;
  const setSourcesOpen = (next: boolean | ((open: boolean) => boolean)) =>
    setSourcesOpenState(typeof next === "function" ? next(sourcesOpen) : next);
  const [pinnedSource, setPinnedSource] = useState<string | null>(null);
  const [hoverSource, setHoverSource] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sourcesById = useMemo(
    () => Object.fromEntries(conversation.sources.map((s) => [s.id, s])) as Record<string, Source>,
    [conversation.sources],
  );
  const activeSourceId = sourcesOpen ? (hoverSource ?? pinnedSource) : null;

  const openSource = (id: string) => {
    setPinnedSource(id);
    setSourcesOpen(true);
  };

  const send = (text: string) => {
    // Static prototype: append the question; wire the real answer stream later.
    setMessages((m) => [...m, { id: `local-${m.length}`, role: "user", text }]);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Thread */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="mx-auto flex w-[min(720px,calc(100%-108px))] flex-col gap-7 pt-3 pb-8 max-sm:w-[calc(100%-32px)]"
        >
          {messages.map((m) =>
            m.role === "user" ? (
              <motion.div key={m.id} variants={riseItem} className="flex w-full justify-end">
                <p className="max-w-[85%] rounded-[22px] bg-surface-muted px-[18px] py-[11px] text-[15px] leading-[22px] whitespace-pre-wrap text-foreground">
                  {m.text}
                </p>
              </motion.div>
            ) : (
              <AssistantAnswer
                key={m.id}
                message={m}
                sources={conversation.sources}
                sourcesById={sourcesById}
                sourcesOpen={sourcesOpen}
                onToggleSources={() => {
                  setPinnedSource(null);
                  setSourcesOpen((v) => !v);
                }}
                activeSourceId={activeSourceId}
                onCiteClick={openSource}
                onCiteHover={setHoverSource}
              />
            ),
          )}
        </motion.div>
      </div>

      <FollowUpComposer onSubmit={send} />

      <ShellRightPanel
        open={sourcesOpen}
        width={320}
        label="Sources"
        onClose={() => setSourcesOpen(false)}
      >
        <SourcesPanel
          sources={conversation.sources}
          searchSteps={conversation.searchSteps}
          searchQuery={conversation.searchQuery}
          activeSourceId={activeSourceId}
          onHoverSource={setHoverSource}
          onClose={() => setSourcesOpen(false)}
        />
      </ShellRightPanel>
    </div>
  );
}

const noopSubscribe = () => () => {};
const readSourcesParam = () => new URLSearchParams(window.location.search).get("sources") === "open";

/** Follow-up composer (740px, 700px with the panel open) + disclaimer. */
function FollowUpComposer({ onSubmit }: { onSubmit?: (text: string) => void }) {
  return (
    <div className="mx-auto w-[min(740px,calc(100%-88px))] shrink-0 pt-3 max-sm:w-[calc(100%-16px)]">
      <Composer placeholder="Ask a follow-up" onSubmit={onSubmit} />
      <p className="mt-[9px] -mb-[5px] text-center text-[11.5px] leading-[14px] text-placeholder">
        AI can make mistakes. Check sources.
      </p>
    </div>
  );
}

/** URL-independent shell shown while a conversation streams in (empty thread + composer). */
export function ChatThreadFallback() {
  return (
    <div className="flex h-full flex-col" aria-busy>
      <div className="min-h-0 flex-1" />
      <FollowUpComposer />
    </div>
  );
}
