"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import type { ChatSummary } from "@/types";
import { SidebarHistoryItem, SidebarNavItem, SidebarSection } from "./sidebar";

/** Body of Figma "Left Sidebar · Chat" (used by /chat and /learn). */
export function ChatSidebarBody({ history }: { history: ChatSummary[] }) {
  const pathname = usePathname();
  const pinned = history.filter((c) => c.pinned);
  const recents = history.filter((c) => !c.pinned);
  const hrefOf = (c: ChatSummary) => c.href ?? `/chat/${c.id}`;

  return (
    <>
      <SidebarNavItem href="/chat" icon="nav-plus" label="New chat" active={pathname === "/chat"} />
      <SidebarNavItem icon="nav-search" label="Search" />
      <SidebarNavItem
        icon="nav-projects"
        label="Projects"
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
        label="Learning paths"
        active={pathname.startsWith("/learn")}
      />

      <SidebarSection title="Pinned">
        {pinned.map((c) => (
          <SidebarHistoryItem key={c.id} href={hrefOf(c)} label={c.title} active={pathname === `/chat/${c.id}`} />
        ))}
      </SidebarSection>
      <SidebarSection title="Recents">
        {recents.map((c) => (
          <SidebarHistoryItem key={c.id} href={hrefOf(c)} label={c.title} active={pathname === `/chat/${c.id}`} />
        ))}
      </SidebarSection>
    </>
  );
}
