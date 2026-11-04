"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Sample interim transcript for the static voice mode (Figma "04 · … + voice"). */
const SAMPLE_TRANSCRIPT = "explain the water cycle in simple terms";

/**
 * Figma "Composer": glass input with tools row (+, Search chip, mic, send).
 * Static for now: `onSubmit` receives the text; wire it to the API later.
 *
 * Voice mode (mic button): shows a "Recording" row with live level bars and the
 * interim transcript; clicking the mic again (or Escape) drops the transcript
 * into the input. Wire real speech recognition through `onVoiceChange` later.
 */
export function Composer({
  placeholder = "Ask anything, in English or Khmer",
  className,
  showSearch = true,
  defaultSearchOn = true,
  leading,
  onSubmit,
  defaultVoiceOn = false,
  voiceTranscript = SAMPLE_TRANSCRIPT,
  onVoiceChange,
  attachIcon = "plus",
  attachLabel = "Add attachment",
}: {
  placeholder?: string;
  className?: string;
  showSearch?: boolean;
  defaultSearchOn?: boolean;
  /** Extra chips after the Search chip (e.g. attached file). */
  leading?: React.ReactNode;
  onSubmit?: (text: string) => void;
  /** Start in voice (listening) mode. */
  defaultVoiceOn?: boolean;
  /** Text revealed word by word while listening (static prototype). */
  voiceTranscript?: string;
  onVoiceChange?: (listening: boolean) => void;
  /** Icon name in /public/icons for the attach button (Documents: "doc-clip", Image: "img-imgplus"). */
  attachIcon?: string;
  attachLabel?: string;
}) {
  const [value, setValue] = useState("");
  const [searchOn, setSearchOn] = useState(defaultSearchOn);
  const [listening, setListening] = useState(defaultVoiceOn);
  const [heard, setHeard] = useState(defaultVoiceOn ? 5 : 0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const words = voiceTranscript.split(/\s+/).filter(Boolean);
  const interim = words.slice(0, heard).join(" ");

  // Reveal the sample transcript one word at a time while listening.
  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => setHeard((n) => Math.min(n + 1, words.length)), 420);
    return () => clearInterval(t);
  }, [listening, words.length]);

  const setVoice = (on: boolean) => {
    setListening(on);
    onVoiceChange?.(on);
  };

  const startVoice = () => {
    setHeard(0);
    setVoice(true);
  };

  const stopVoice = () => {
    if (interim) setValue((v) => (v ? `${v} ${interim}` : interim));
    setVoice(false);
    ref.current?.focus();
  };

  const submit = () => {
    const text = [value.trim(), listening ? interim : ""].filter(Boolean).join(" ");
    if (listening) setVoice(false);
    if (!text) return;
    onSubmit?.(text);
    setValue("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onClick={() => ref.current?.focus()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && listening) {
          e.preventDefault();
          stopVoice();
        }
      }}
      className={cn(
        "glass flex w-full cursor-text flex-col rounded-[28px] py-[14px] pr-3 pl-4 transition-shadow focus-within:shadow-[var(--shadow-glass-value),0_0_0_3px_var(--brand-blue-soft)]",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {listening && (
          <motion.div
            key="recording"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div role="status" aria-live="polite" className="flex items-center gap-[10px] pb-[10px]">
              <LevelBars />
              <span className="shrink-0 text-[13px] font-medium whitespace-nowrap text-muted-foreground">
                Listening…
              </span>
              <span className="min-w-0 truncate text-[13px] text-placeholder">{interim}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field-sizing-content max-h-40 w-full resize-none bg-transparent text-[15.5px] leading-[normal] text-foreground outline-none placeholder:text-placeholder"
      />
      <div className="mt-[10px] flex w-full items-center gap-[6px]">
        <button
          type="button"
          aria-label={attachLabel}
          className="flex size-[34px] items-center justify-center rounded-[17px] text-icon transition-colors hover:bg-accent"
        >
          <Icon name={attachIcon} size={18} />
        </button>
        {showSearch && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            aria-pressed={searchOn}
            onClick={() => setSearchOn((v) => !v)}
            className={cn(
              "flex items-center justify-center gap-[6px] rounded-full px-3 py-[7px] text-[12.5px] font-medium transition-[background,color,box-shadow] duration-200",
              searchOn
                ? "bg-primary-fill"
                : "border border-border text-foreground hover:bg-accent",
            )}
          >
            <Icon name="globe" size={14} />
            Search
          </motion.button>
        )}
        {leading}
        <div className="h-px min-w-px flex-1" />
        <motion.button
          type="button"
          aria-label={listening ? "Stop voice input" : "Voice input"}
          aria-pressed={listening}
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            e.stopPropagation();
            if (listening) stopVoice();
            else startVoice();
          }}
          className={cn(
            "flex size-[34px] items-center justify-center rounded-[17px] transition-colors",
            listening
              ? "bg-destructive/14 text-destructive hover:bg-destructive/20"
              : "text-icon hover:bg-accent",
          )}
        >
          <Icon name="mic" size={17} />
        </motion.button>
        <motion.button
          type="submit"
          aria-label="Send"
          whileTap={{ scale: 0.92 }}
          className="bg-primary-fill flex size-9 items-center justify-center rounded-[18px] transition-opacity disabled:opacity-60"
        >
          <Icon name="up" size={17} />
        </motion.button>
      </div>
    </form>
  );
}

/** Figma "Recording" level meter: 5 bars, 3px wide, 2px gap, up to 16px tall. */
const BAR_HEIGHTS = [6, 12, 16, 10, 5];

function LevelBars() {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="flex h-4 items-center gap-[2px]">
      {BAR_HEIGHTS.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-[2px] bg-danger-strong"
          style={{ height: h }}
          animate={reduce ? undefined : { height: [h, Math.max(4, 16 - h + 2), h] }}
          transition={{
            duration: 0.7 + i * 0.09,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.06,
          }}
        />
      ))}
    </span>
  );
}
