"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { initialsOf, modelLabel, SessionProvider, useSession } from "@/lib/session";
import type { AppSection, ChatSummary, ModelStatus, User } from "@/types";
import { ChatWidthDialog } from "./chat-width-dialog";
import { AppGlows } from "./glows";
import { sectionOf, ShellProvider, useShell } from "./shell-context";
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
  /** Default landing page for each tab before the user has visited it. */
  tabHomes: { chat: string; documents: string; image: string };
};

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ShellProvider>
        <ShellLayout data={data}>{children}</ShellLayout>
      </ShellProvider>
    </SessionProvider>
  );
}

/**
 * Layout: [sidebar] [header (full width, stable) / content + right panel].
 * The header spans the whole area right of the sidebar, so the tab bar stays
 * in the same place on every page; side panels open underneath it.
 */
function ShellLayout({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionOf(pathname);
  const { setRightPanelHost, chatWidthOpen, setChatWidthOpen } = useShell();
  const session = useSession();

  // Live data for the Chat tab; the other tabs keep their prototype data until their phase.
  const user: User = session.me
    ? { id: session.me.user.id, name: session.me.user.name, initials: initialsOf(session.me.user.name), plan: session.me.user.email }
    : { ...data.user, name: "", initials: "", plan: "" };
  const chatHistory: ChatSummary[] = session.chats.map((c) => ({ id: c.id, title: c.title }));
  const liveModel = modelLabel(session.provider);
  const chatStatus: ModelStatus = liveModel
    ? { name: liveModel, state: "ready", detail: { en: "Runs on this computer", km: "ដំណើរការលើកុំព្យូទ័រនេះ" } }
    : { name: "—", state: "idle", detail: { en: "No model connected", km: "មិនទាន់ភ្ជាប់ម៉ូដែល" } };
  const isChat = section === "chat" || section === "learn";

  const sidebarKey = section === "learn" ? "chat" : section;
  const body = (
    <motion.div
      key={sidebarKey}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-[2px]"
    >
      {data.sidebars[section] ?? <ChatSidebarBody history={chatHistory} />}
    </motion.div>
  );

  return (
    <div className="bg-window relative flex h-dvh w-full overflow-hidden p-2 sm:p-4">
      <AppGlows />
      <SidebarFrame body={body} status={isChat ? chatStatus : data.modelStatuses[section]} user={user} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar section={section} model={isChat ? liveModel : data.sectionModels[section]} tabHomes={data.tabHomes} />
        <div className="relative flex min-h-0 flex-1">
          <main className="relative min-w-0 flex-1">{children}</main>
          <div ref={setRightPanelHost} className="relative flex h-full shrink-0" />
        </div>
      </div>
      <ChatWidthDialog open={chatWidthOpen} onOpenChange={setChatWidthOpen} />
    </div>
  );
}
