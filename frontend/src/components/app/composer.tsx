"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/provider";
import { useOptionalStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useVoice } from "@/lib/voice/use-voice";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Figma "Composer": glass input with tools row (+, Search chip, mic, send).
 * Static for now: `onSubmit` receives the text; wire it to the API later.
 *
 * Voice mode (mic button, FRONTEND.md §10): streams the microphone to the voice relay; the "Recording" row shows
 * live level bars and the partial transcript, each final sentence is appended to the input. Clicking the mic again
 * (or Escape) stops. Outside the app shell (landing page) the mic is decorative; it is hidden when voice is off.
 */
export function Composer({
  placeholder: placeholderProp,
  className,
  showSearch = true,
  defaultSearchOn = true,
  leading,
  onSubmit,
  onVoiceChange,
  attachIcon = "plus",
  attachLabel: attachLabelProp,
  onAttach,
  busy = false,
  onStop,
  onSearchChange,
}: {
  placeholder?: string;
  className?: string;
  showSearch?: boolean;
  defaultSearchOn?: boolean;
  /** Extra chips after the Search chip (e.g. attached file). */
  leading?: React.ReactNode;
  onSubmit?: (text: string, options: { webSearch: boolean }) => void;
  /** A reply is being generated: Enter does nothing and the send button becomes Stop. */
  busy?: boolean;
  onStop?: () => void;
  onSearchChange?: (on: boolean) => void;
  onVoiceChange?: (listening: boolean) => void;
  /** Icon name in /public/icons for the attach button (Documents: "doc-clip", Image: "img-imgplus"). */
  attachIcon?: string;
  attachLabel?: string;
  /** Attach button action (Documents: open the file picker). */
  onAttach?: () => void;
}) {
  const m = useMessages().app.composer;
  const placeholder = placeholderProp ?? m.placeholder;
  const attachLabel = attachLabelProp ?? m.addAttachment;
  const [value, setValue] = useState("");
  const [searchOn, setSearchOn] = useState(defaultSearchOn);
  const ref = useRef<HTMLTextAreaElement>(null);
  const status = useOptionalStatus();
  const voiceShown = status === null || status.features?.voice === true;
  const voice = useVoice((text) => setValue((v) => (v ? `${v} ${text}` : text)));
  const listening = voice.state !== "idle";
  const interim = voice.partial;

  useEffect(() => {
    onVoiceChange?.(listening);
  }, [listening, onVoiceChange]);

  const startVoice = () => {
    if (status === null) return; // static composer (landing page)
    void voice.start();
  };

  const stopVoice = () => {
    voice.stop();
    ref.current?.focus();
  };

  const submit = () => {
    const text = [value.trim(), listening ? interim : ""].filter(Boolean).join(" ");
    if (listening) voice.stop();
    if (!text || busy) return;
    onSubmit?.(text, { webSearch: showSearch && searchOn });
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
              <LevelBars level={voice.level} />
              <span className="shrink-0 text-[13px] font-medium whitespace-nowrap text-muted-foreground">
                {voice.state === "connecting" ? m.voiceConnecting : m.listening}
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
          onClick={onAttach}
          className="flex size-[34px] items-center justify-center rounded-[17px] text-icon transition-colors hover:bg-accent"
        >
          <Icon name={attachIcon} size={18} />
        </button>
        {showSearch && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            aria-pressed={searchOn}
            onClick={() =>
              setSearchOn((v) => {
                onSearchChange?.(!v);
                return !v;
              })
            }
            className={cn(
              "flex items-center justify-center gap-[6px] rounded-full px-3 py-[7px] text-[12.5px] font-medium transition-[background,color,box-shadow] duration-200",
              searchOn
                ? "bg-primary-fill"
                : "border border-border text-foreground hover:bg-accent",
            )}
          >
            <Icon name="globe" size={14} />
            {m.search}
          </motion.button>
        )}
        {leading}
        <div className="h-px min-w-px flex-1" />
        {voice.error && (
          <span role="alert" className="max-w-[45%] truncate text-[12px] text-destructive" title={m.voiceErrors[voice.error]}>
            {m.voiceErrors[voice.error]}
          </span>
        )}
        {voiceShown && (
        <motion.button
          type="button"
          aria-label={listening ? m.stopVoice : m.voiceInput}
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
        )}
        {busy ? (
          <motion.button
            type="button"
            aria-label={m.stop}
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.stopPropagation();
              onStop?.();
            }}
            className="bg-primary-fill flex size-9 items-center justify-center rounded-[18px]"
          >
            <Square size={13} fill="currentColor" strokeWidth={0} />
          </motion.button>
        ) : (
          <motion.button
            type="submit"
            aria-label={m.send}
            whileTap={{ scale: 0.92 }}
            className="bg-primary-fill flex size-9 items-center justify-center rounded-[18px] transition-opacity disabled:opacity-60"
          >
            <Icon name="up" size={17} />
          </motion.button>
        )}
      </div>
    </form>
  );
}

/** Figma "Recording" level meter: 5 bars, 3px wide, 2px gap, up to 16px tall. */
const BAR_HEIGHTS = [6, 12, 16, 10, 5];

function LevelBars({ level }: { level: number }) {
  const reduce = useReducedMotion() || level > 0;
  return (
    <span aria-hidden className="flex h-4 items-center gap-[2px]">
      {BAR_HEIGHTS.map((h, i) => (
        <motion.span
          key={i}
          className="h-4 w-[3px] origin-center rounded-[2px] bg-danger-strong"
          style={{ scaleY: level > 0 ? Math.min(1, 0.25 + level * 3 * (h / 16)) : h / 16 }}
          animate={reduce ? undefined : { scaleY: [h / 16, Math.max(4, 16 - h + 2) / 16, h / 16] }}
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
