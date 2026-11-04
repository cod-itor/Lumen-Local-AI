"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Figma "Composer": glass input with tools row (+, Search chip, mic, send).
 * Static for now: `onSubmit` receives the text; wire it to the API later.
 */
export function Composer({
  placeholder = "Ask anything, in English or Khmer",
  className,
  showSearch = true,
  defaultSearchOn = true,
  leading,
  onSubmit,
}: {
  placeholder?: string;
  className?: string;
  showSearch?: boolean;
  defaultSearchOn?: boolean;
  /** Extra chips after the Search chip (e.g. attached file). */
  leading?: React.ReactNode;
  onSubmit?: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [searchOn, setSearchOn] = useState(defaultSearchOn);
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const text = value.trim();
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
      className={cn(
        "glass flex w-full cursor-text flex-col gap-[10px] rounded-[28px] py-[14px] pr-3 pl-4 transition-shadow focus-within:shadow-[var(--shadow-glass-value),0_0_0_3px_var(--brand-blue-soft)]",
        className,
      )}
    >
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
      <div className="flex w-full items-center gap-[6px]">
        <button
          type="button"
          aria-label="Add attachment"
          className="flex size-[34px] items-center justify-center rounded-[17px] text-icon transition-colors hover:bg-accent"
        >
          <Icon name="plus" size={18} />
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
        <button
          type="button"
          aria-label="Voice input"
          className="flex size-[34px] items-center justify-center rounded-[17px] text-icon transition-colors hover:bg-accent"
        >
          <Icon name="mic" size={17} />
        </button>
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
