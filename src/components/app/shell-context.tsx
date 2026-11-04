"use client";

import { createContext, useContext, useState } from "react";

type ShellState = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  /** DOM node the page's right panel portals into (see <ShellRightPanel>). */
  rightPanelHost: HTMLDivElement | null;
  setRightPanelHost: (el: HTMLDivElement | null) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelHost, setRightPanelHost] = useState<HTMLDivElement | null>(null);

  return (
    <ShellContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar: () => setSidebarOpen((v) => !v),
        rightPanelHost,
        setRightPanelHost,
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
