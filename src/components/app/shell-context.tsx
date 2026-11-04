"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { AppSection } from "@/types";

/** Tabs remember the last page visited in each section (best-practice tab UX). */
type LastPaths = Partial<Record<"chat" | "documents" | "image", string>>;

type ShellState = {
  /** Viewport ≥ 1024px: docked sidebar + side panels. Below: drawer + sheets. */
  isDesktop: boolean;
  /** Desktop docked sidebar. */
  sidebarOpen: boolean;
  /** Mobile drawer. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  /** Toggles whichever sidebar the current viewport uses. */
  toggleSidebar: () => void;
  /** DOM node the page's right panel portals into (see <ShellRightPanel>). */
  rightPanelHost: HTMLDivElement | null;
  setRightPanelHost: (el: HTMLDivElement | null) => void;
  lastPaths: LastPaths;
  /** Settings → Chat width dialog (lives in the shell so it outlasts the mobile drawer). */
  chatWidthOpen: boolean;
  setChatWidthOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true, // server render assumes desktop; mobile corrects on hydrate
  );
}

export function sectionOf(pathname: string): AppSection {
  const seg = pathname.split("/")[1];
  return seg === "documents" || seg === "image" || seg === "learn" ? seg : "chat";
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [chatWidthOpen, setChatWidthOpen] = useState(false);
  const [rightPanelHost, setRightPanelHost] = useState<HTMLDivElement | null>(null);
  const [lastPaths, setLastPaths] = useState<LastPaths>({});
  const [seenPath, setSeenPath] = useState<string | null>(null);

  // On navigation (adjusting state during render, per React docs — no extra effect pass):
  // remember where the user was in each tab, and close the mobile drawer.
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    const section = sectionOf(pathname);
    const tab = section === "learn" ? "chat" : section;
    setLastPaths((prev) => (prev[tab] === pathname ? prev : { ...prev, [tab]: pathname }));
    setMobileNavOpen(false);
  }

  return (
    <ShellContext.Provider
      value={{
        isDesktop,
        sidebarOpen,
        mobileNavOpen,
        setMobileNavOpen,
        toggleSidebar: () =>
          isDesktop ? setSidebarOpen((v) => !v) : setMobileNavOpen((v) => !v),
        rightPanelHost,
        setRightPanelHost,
        lastPaths,
        chatWidthOpen,
        setChatWidthOpen,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
