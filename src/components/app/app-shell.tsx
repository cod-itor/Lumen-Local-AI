"use client";

import { usePathname } from "next/navigation";
import type { AppSection, ChatSummary, ModelStatus, User } from "@/types";
import { AppGlows } from "./glows";
import { ShellProvider, useShell } from "./shell-context";
import { SidebarFrame } from "./sidebar";
import { ChatSidebarBody } from "./sidebar-chat";
import { TopBar } from "./top-bar";

export type ShellData = {
  user: User;
  chatHistory: ChatSummary[];
  sectionModels: Record<AppSection, string | null>;
  modelStatuses: Record<AppSection, ModelStatus>;
  /** Section-specific sidebar bodies rendered on the server (documents, image). */
  sidebars: Partial<Record<AppSection, React.ReactNode>>;
};

function sectionOf(pathname: string): AppSection {
  const seg = pathname.split("/")[1];
  return seg === "documents" || seg === "image" || seg === "learn" ? seg : "chat";
}

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ShellLayout data={data}>{children}</ShellLayout>
    </ShellProvider>
  );
}

function ShellLayout({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const { setRightPanelHost } = useShell();

  const body = data.sidebars[section] ?? <ChatSidebarBody history={data.chatHistory} />;

  return (
    <div className="bg-window relative flex h-dvh min-h-[640px] w-full overflow-hidden p-4">
      <AppGlows />
      <SidebarFrame body={body} status={data.modelStatuses[section]} user={data.user} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar section={section} model={data.sectionModels[section]} />
        <main className="relative min-h-0 flex-1">{children}</main>
      </div>
      <div ref={setRightPanelHost} className="relative flex h-full shrink-0" />
    </div>
  );
}
