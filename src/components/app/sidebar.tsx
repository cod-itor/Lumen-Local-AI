"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { LogOut, MoveHorizontal, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Icon } from "@/components/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ModelStatus, User } from "@/types";
import { ResizeHandle, useResizableWidth } from "./resize-handle";
import { useShell } from "./shell-context";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ frame */

/**
 * Glass sidebar frame shared by every section (Figma "Left Sidebar · Chat |
 * Documents | Image"): logo row, a section-specific body, model status, account.
 */
export function SidebarFrame({
  body,
  status,
  user,
}: {
  body: React.ReactNode;
  status: ModelStatus;
  user: User;
}) {
  const { isDesktop, sidebarOpen, mobileNavOpen, setMobileNavOpen, toggleSidebar } = useShell();
  const rs = useResizableWidth({
    storageKey: "lumen:sidebar-width",
    defaultWidth: 272,
    min: 232,
    max: 400,
  });

  const panel = (
    <>
      {/* Logo row */}
      <div className="flex w-full items-center justify-between pb-3 pl-2">
        <Link href="/" className="flex items-center gap-[7px]">
          <Icon name="spark" size={18} className="text-foreground" />
          <span className="text-[17px] font-semibold tracking-[-0.17px] text-foreground">Lumen</span>
        </Link>
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={toggleSidebar}
          className="flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent"
        >
          <Icon name="panel" size={17} />
        </button>
      </div>

      {/* Section body: nav + lists */}
      <div className="flex min-h-0 w-full flex-1 flex-col gap-[2px] overflow-y-auto [scrollbar-width:none]">
        {body}
      </div>

      <ModelStatusCard status={status} />
      <AccountRow user={user} />
    </>
  );

  // Mobile / tablet: slide-in drawer over the content.
  if (!isDesktop) {
    return (
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="backdrop"
              aria-hidden
              onClick={() => setMobileNavOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/45"
            />
            <motion.aside
              key="drawer"
              aria-label="Sidebar"
              initial={{ x: "-105%" }}
              animate={{ x: 0 }}
              exit={{ x: "-105%" }}
              transition={{ duration: 0.3, ease: EASE }}
              className="glass fixed inset-y-2 left-2 z-50 flex w-[min(300px,calc(100vw-48px))] flex-col gap-[2px] rounded-[28px] bg-background/80 px-3 pt-4 pb-[14px]"
            >
              {panel}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {sidebarOpen && (
        <motion.div
          key="sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: rs.width + 16, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={rs.dragging ? { duration: 0 } : { duration: 0.32, ease: EASE }}
          className="relative h-full shrink-0 overflow-hidden"
        >
          <motion.aside
            aria-label="Sidebar"
            initial={{ x: -24 }}
            animate={{ x: 0 }}
            exit={{ x: -24 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ width: rs.width }}
            className="glass flex h-full flex-col gap-[2px] rounded-[28px] px-3 pt-4 pb-[14px]"
          >
            {panel}
          </motion.aside>
          <ResizeHandle side="right" label="Resize sidebar" className="right-[2px]" {...rs} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Shown in place of the sidebar when it's closed (Figma "Sidebar Closed · Controls"). */
export function SidebarClosedControls() {
  const { isDesktop, sidebarOpen, toggleSidebar } = useShell();
  const show = !isDesktop || !sidebarOpen;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="closed-controls"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="glass flex h-[42px] w-[76px] shrink-0 items-center justify-center gap-[2px] rounded-[16px] p-1"
        >
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={toggleSidebar}
            className="flex size-[32px] items-center justify-center rounded-[12px] text-icon transition-colors hover:bg-accent"
          >
            <Icon name="panel" size={17} />
          </button>
          <Link
            href="/chat"
            aria-label="New chat"
            className="flex size-[32px] items-center justify-center rounded-[12px] text-icon transition-colors hover:bg-accent"
          >
            <Icon name="edit" size={17} />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ list pieces */

/** Figma "Sidebar/Nav Item": 40px row, 20px icon, 14.5px label. */
export function SidebarNavItem({
  href,
  icon,
  label,
  active,
  trailing,
  onClick,
}: {
  href?: string;
  icon: string;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const className = cn(
    "relative flex h-10 w-full shrink-0 items-center gap-3 rounded-[12px] pr-2 pl-[10px] text-left transition-colors",
    !active && "hover:bg-accent/60",
  );
  const content = (
    <>
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-[12px] bg-nav-active shadow-soft"
        />
      )}
      <span className="relative flex size-5 items-center justify-center">
        <Icon name={icon} size={19} className="text-foreground-tertiary" />
      </span>
      <span className="relative min-w-0 flex-1 text-[14.5px] text-foreground">{label}</span>
      {trailing && <span className="relative">{trailing}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

/** Figma "Section · Pinned / Recents": collapsible group header with caret. */
export function SidebarSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex w-full flex-col gap-[2px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 pt-[18px] pb-[6px] pl-[10px] text-left"
      >
        <span className="text-[12.5px] font-medium text-subtle">{title}</span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <Icon name="caret" size={10} className="text-subtle" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="flex flex-col gap-[2px] overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Figma "Sidebar/History Item": 34px row, 13.5px truncated label. */
export function SidebarHistoryItem({
  href,
  label,
  active,
  trailing,
}: {
  href: string;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-[34px] w-full shrink-0 items-center gap-2 rounded-[10px] px-[10px] transition-colors",
        !active && "hover:bg-accent/60",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-[10px] bg-nav-active shadow-soft"
        />
      )}
      <span className="relative min-w-0 flex-1 truncate text-[13.5px] text-foreground-secondary">
        {label}
      </span>
      {trailing && <span className="relative shrink-0">{trailing}</span>}
    </Link>
  );
}

/* --------------------------------------------------------------- footer */

function ModelStatusCard({ status }: { status: ModelStatus }) {
  const dot =
    status.state === "ready" ? "bg-success" : status.state === "loading" ? "bg-yellow" : "bg-subtle";
  return (
    <div className="glass mt-2 flex w-full shrink-0 flex-col gap-[3px] rounded-[14px] px-3 py-[10px]">
      <div className="flex w-full items-center gap-[7px]">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        <span className="min-w-0 flex-1 text-[12.5px] font-medium text-foreground">
          {status.name}
        </span>
        <span className="text-[11.5px] text-success-foreground">{status.stateLabel}</span>
      </div>
      <span className="text-[11px] text-muted-foreground">{status.detail}</span>
    </div>
  );
}

function AccountRow({ user }: { user: User }) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { setMobileNavOpen, setChatWidthOpen } = useShell();
  return (
    <div className="flex w-full shrink-0 items-center gap-[10px] pt-[10px] pl-[6px]">
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[17px] bg-brand-gradient text-[12px] font-semibold text-white">
        {user.initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px whitespace-nowrap">
        <span className="text-[13px] font-medium text-foreground">{user.name}</span>
        <span className="text-[11px] text-muted-foreground">{user.plan}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Settings"
          className="flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent data-[popup-open]:bg-accent"
        >
          <Icon name="sliders" size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(String(v))}>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                setMobileNavOpen(false);
                setChatWidthOpen(true);
              }}
            >
              <MoveHorizontal />
              Chat width…
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings />
            Settings & AI models
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* UI only for now: clear the session here once auth is wired up. */}
          <DropdownMenuItem onClick={() => router.push("/login")}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
