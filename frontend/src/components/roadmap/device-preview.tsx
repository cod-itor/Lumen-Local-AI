"use client";

import { motion, useInView } from "motion/react";
import { Laptop, Monitor, WifiOff } from "lucide-react";
import { useRef } from "react";
import { EASE } from "@/components/landing/motion";
import { useMessages } from "@/i18n/provider";

/**
 * Mock of the planned website UI for devices — what "online / offline"
 * will look like. Purely illustrative; no real devices.
 */
export function DevicePreview() {
  const t = useMessages().roadmap.devices;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="glass flex flex-col gap-3 rounded-3xl p-5">
        <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t.settings}</span>
        <DeviceRow
          icon={<Laptop className="size-4.5" strokeWidth={1.8} />}
          name={t.laptopName}
          meta={t.laptopMeta}
          online
          status={t.online}
        />
        <DeviceRow
          icon={<Monitor className="size-4.5" strokeWidth={1.8} />}
          name={t.pcName}
          meta={t.pcMeta}
          status={t.offline}
        />
      </div>
      <div className="glass flex flex-col justify-center gap-3 rounded-3xl p-5">
        <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">{t.inChat}</span>
        <div className="flex items-start gap-3 rounded-2xl border border-brand-orange-line/60 bg-brand-orange-soft p-4">
          <WifiOff className="mt-0.5 size-4.5 shrink-0 text-brand-orange-strong dark:text-brand-orange" strokeWidth={1.8} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold text-foreground">{t.offlineTitle}</span>
            <span className="text-[13px] leading-[18px] text-muted-foreground [:lang(km)_&]:leading-[22px]">{t.offlineBody}</span>
          </div>
        </div>
        <FirstRunProgress />
      </div>
    </div>
  );
}

function DeviceRow({
  icon,
  name,
  meta,
  status,
  online,
}: {
  icon: React.ReactNode;
  name: string;
  meta: string;
  status: string;
  online?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-foreground/5 p-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-foreground/8 text-foreground">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium text-foreground">{name}</span>
        <span className="truncate text-[12.5px] text-muted-foreground">{meta}</span>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium whitespace-nowrap">
        <span className="relative flex size-2">
          {online && <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />}
          <span className={online ? "relative size-2 rounded-full bg-success" : "relative size-2 rounded-full bg-muted-foreground/50"} />
        </span>
        <span className={online ? "text-success-foreground" : "text-muted-foreground"}>{status}</span>
      </span>
    </div>
  );
}

/** "Downloading models" progress from the desktop first run, filled once on view. */
function FirstRunProgress() {
  const t = useMessages().roadmap.devices;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  return (
    <div ref={ref} className="flex flex-col gap-2 rounded-2xl bg-foreground/5 p-4">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-medium text-foreground">{t.setup}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{t.size}</span>
      </div>
      <span className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <motion.span
          className="bg-brand-gradient block h-full origin-left rounded-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: inView ? 0.66 : 0 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      </span>
    </div>
  );
}
