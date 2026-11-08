"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Composer "1:1" chip: picks the output aspect ratio. */
export function AspectRatioChip({ options, defaultValue }: { options: string[]; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const m = useMessages().app.image;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={format(m.aspectRatioValue, { value })}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-[6px] rounded-full border border-border px-3 py-[7px] text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        {value}
        <Icon name="chev" size={13} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.aspectRatio}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => setValue(String(v))}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o} value={o}>
                {o}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
