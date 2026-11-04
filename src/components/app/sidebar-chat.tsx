"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/provider";
import type { ChatSummary } from "@/types";
import { SidebarHistoryItem, SidebarNavItem, SidebarSection } from "./sidebar";

/** Body of Figma "Left Sidebar · Chat" (used by /chat and /learn). */
export function ChatSidebarBody({ history }: { history: ChatSummary[] }) {
  const pathname = usePathname();
  const m = useMessages().app.sidebar;
  const pinned = history.filter((c) => c.pinned);
  const recents = history.filter((c) => !c.pinned);
  const hrefOf = (c: ChatSummary) => c.href ?? `/chat/${c.id}`;

  return (
    <>
      <SidebarNavItem href="/chat" icon="nav-plus" label={m.newChat} active={pathname === "/chat"} />
      <SidebarNavItem icon="nav-search" label={m.search} />
      <SidebarNavItem
        icon="nav-projects"
        label={m.projects}
        trailing={
          <span
            role="presentation"
            className="flex size-[26px] items-center justify-center rounded-[13px] text-icon transition-colors hover:bg-accent"
          >
            <Icon name="plus-sm" size={17} />
          </span>
        }
      />
      <SidebarNavItem
        href="/learn"
        icon="nav-cap"
        label={m.learningPaths}
        active={pathname.startsWith("/learn")}
      />

      <SidebarSection title={m.pinned}>
        {pinned.map((c) => (
          <SidebarHistoryItem key={c.id} href={hrefOf(c)} label={c.title} active={pathname === `/chat/${c.id}`} />
        ))}
      </SidebarSection>
      <SidebarSection title={m.recents}>
        {recents.map((c) => (
          <SidebarHistoryItem key={c.id} href={hrefOf(c)} label={c.title} active={pathname === `/chat/${c.id}`} />
        ))}
      </SidebarSection>
    </>
  );
}
