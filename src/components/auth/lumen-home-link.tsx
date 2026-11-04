"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMessages } from "@/i18n/provider";

/** Logo link back to the landing page, with a translated label. */
export function LumenHomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const m = useMessages();
  return (
    <Link href="/" aria-label={m.common.lumenHome} className={className}>
      {children}
    </Link>
  );
}
