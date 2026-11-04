"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Composer } from "@/components/app/composer";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { ImageThread as ImageThreadData, ImageThreadMessage } from "@/types/images";
import { ApprovalCard } from "./approval-card";
import { AspectRatioChip } from "./aspect-ratio-chip";
import { ImageTile } from "./image-tile";
import { riseItem } from "./motion";

/** Figma "06 · Image · Prompt approval": thread + composer + disclaimer. */
export function ImageThread({ thread }: { thread: ImageThreadData }) {
  const [messages, setMessages] = useState<ImageThreadMessage[]>(thread.messages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const m = useMessages().app.image;
  const resultHref =
    thread.messages.findLast((m) => m.kind === "approval")?.resultHref ?? "/image";

  // Keep the latest message (the prompt awaiting approval) in view.
  const mounted = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: mounted.current ? "smooth" : "instant" });
    mounted.current = true;
  }, [messages.length]);

  // Static prototype: a new request gets echoed back as a prompt awaiting approval.
  const submit = (text: string) => {
    const n = Date.now();
    setMessages((prev) => [
      ...prev,
      { kind: "user", id: `u${n}`, text },
      { kind: "approval", id: `a${n}`, prompt: text, resultHref },
    ]);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="mx-auto flex w-full max-w-(--chat-width) flex-col gap-7 px-1 pt-3 pb-3"
        >
          {messages.map((msg) => (
            <motion.div key={msg.id} variants={riseItem}>
              <Message message={msg} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="mx-auto w-full max-w-[calc(var(--chat-width)+20px)] shrink-0">
        <Composer
          placeholder={m.placeholder}
          showSearch={false}
          attachIcon="img-imgplus"
          attachLabel={m.addReference}
          leading={
            <AspectRatioChip options={thread.aspectRatios} defaultValue={thread.defaultAspectRatio} />
          }
          onSubmit={submit}
        />
        <p className="pt-[3px] text-center text-[11.5px] text-subtle">{m.disclaimer}</p>
      </div>
    </div>
  );
}

function Message({ message: m }: { message: ImageThreadMessage }) {
  const openTemplate = useMessages().app.image.openImage;
  switch (m.kind) {
    case "user":
      return (
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-[22px] bg-surface-muted px-[18px] py-[11px] text-[15px] leading-[22px] text-foreground">
            {m.text}
          </p>
        </div>
      );
    case "images":
      return (
        <div className="flex flex-col gap-[14px]">
          <div className="grid grid-cols-4 gap-[10px]">
            {m.images.map((image) => (
              <Link
                key={image.id}
                href={`/image/${image.id}`}
                aria-label={format(openTemplate, { alt: image.alt })}
                className="group block rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ImageTile
                  image={image}
                  sizes="172px"
                  className="transition-transform duration-300 ease-[var(--ease-out-smooth)] group-hover:scale-[1.03]"
                />
              </Link>
            ))}
          </div>
          <MessageActions />
        </div>
      );
    case "clarify":
      return <Clarify question={m.question} options={m.options} defaultSelected={m.selected} />;
    case "approval":
      return <ApprovalCard prompt={m.prompt} resultHref={m.resultHref} />;
  }
}

function Clarify({
  question,
  options,
  defaultSelected,
}: {
  question: string;
  options: string[];
  defaultSelected: string;
}) {
  const [selected, setSelected] = useState(defaultSelected);
  return (
    <div className="flex flex-col gap-[14px]">
      <p className="text-[15.5px] leading-[26px] text-foreground">{question}</p>
      <div className="flex gap-[6px]" role="radiogroup" aria-label={question}>
        {options.map((o) => {
          const on = o === selected;
          return (
            <motion.button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelected(o)}
              className={cn(
                "rounded-full px-[13px] py-[7px] text-[13px] font-medium transition-[background,color,box-shadow] duration-200",
                on ? "bg-primary-fill" : "border border-border text-foreground hover:bg-accent",
              )}
            >
              {o}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const ACTIONS = [
  { icon: "img-copy", label: "copyPrompt" },
  { icon: "img-tup", label: "goodResult", toggle: true },
  { icon: "img-tdown", label: "badResult", toggle: true },
  { icon: "img-refresh", label: "regenerate" },
  { icon: "img-lang", label: "translate" },
] as const;

function MessageActions() {
  const [rated, setRated] = useState<string | null>(null);
  const labels = useMessages().app.image.actions;
  return (
    <div className="flex items-center gap-[2px]">
      {ACTIONS.map((a) => {
        const on = "toggle" in a && rated === a.icon;
        return (
          <motion.button
            key={a.icon}
            type="button"
            aria-label={labels[a.label]}
            title={labels[a.label]}
            aria-pressed={"toggle" in a ? on : undefined}
            whileTap={{ scale: 0.9 }}
            onClick={() => "toggle" in a && setRated(on ? null : a.icon)}
            className={cn(
              "flex size-[30px] items-center justify-center rounded-[15px] transition-colors hover:bg-accent hover:text-foreground",
              on ? "bg-accent text-foreground" : "text-icon",
            )}
          >
            <Icon name={a.icon} size={15} />
          </motion.button>
        );
      })}
    </div>
  );
}
