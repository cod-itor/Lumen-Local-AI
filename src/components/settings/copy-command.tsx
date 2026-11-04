"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";

/** A terminal command (or download link) with a copy button. */
export function CopyCommand({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const m = useMessages();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const isLink = value.startsWith("https://");

  if (!value.startsWith("ollama") && !isLink) {
    return <p className="text-[13.5px] text-muted-foreground">{value}</p>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-foreground/8 bg-foreground/5 py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">
        {isLink ? value.replace("https://", "") : <><span className="text-muted-foreground select-none">$ </span>{value}</>}
      </code>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-foreground hover:bg-accent"
        >
          {m.common.open} <ExternalLink className="size-3.5" />
        </a>
      ) : (
        <Button variant="ghost" size="sm" onClick={copy} aria-label={format(m.settings.copyCommand, { command: value })} className="h-7 rounded-lg">
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? m.common.copied : m.common.copy}
        </Button>
      )}
    </div>
  );
}
