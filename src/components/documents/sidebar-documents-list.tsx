"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarNavItem, SidebarSection } from "@/components/app/sidebar";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { DocumentChatSummary, Material } from "@/types/documents";
import { FileBadge, useMaterialMeta } from "./file-badge";

const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

export function DocumentsSidebarList({
  materials,
  chats,
}: {
  materials: Material[];
  chats: DocumentChatSummary[];
}) {
  const pathname = usePathname();
  const currentId = pathname.startsWith("/documents/") ? pathname.split("/")[2] : null;
  const m = useMessages().app.sidebar;

  return (
    <>
      <SidebarNavItem href="/documents" icon="nav-plus" label={m.newDocumentChat} />
      <SidebarNavItem icon="nav-search" label={m.search} />
      <SidebarNavItem
        icon="doc-book"
        label={m.materials}
        active
        trailing={
          <span
            role="presentation"
            className="flex size-[26px] items-center justify-center rounded-[13px] text-icon transition-colors hover:bg-accent"
          >
            <Icon name="plus-sm" size={17} />
          </span>
        }
      />

      <SidebarSection title={m.sharedMaterials}>
        {materials.map((mat) => (
          <MaterialRow key={mat.id} material={mat} active={mat.id === currentId} />
        ))}
      </SidebarSection>
      <SidebarSection title={m.recents}>
        {chats.map((c) => {
          const active = c.materialId === currentId;
          return (
            <Link
              key={c.id}
              href={`/documents/${c.materialId}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-[34px] w-full shrink-0 items-center rounded-[10px] px-[10px] transition-colors",
                !active && "hover:bg-accent/60",
              )}
            >
              {active && (
                <motion.span
                  layoutId="doc-recent-active"
                  transition={SPRING}
                  className="absolute inset-0 rounded-[10px] bg-nav-active shadow-soft"
                />
              )}
              <span className="relative min-w-0 flex-1 truncate text-[13.5px] text-foreground-secondary">
                {c.title}
              </span>
            </Link>
          );
        })}
      </SidebarSection>
    </>
  );
}

/** Figma "Material Item": 46px row with file badge, name and status line. */
function MaterialRow({ material: m, active }: { material: Material; active: boolean }) {
  const materialMeta = useMaterialMeta();
  return (
    <Link
      href={`/documents/${m.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-[46px] w-full shrink-0 items-center gap-[10px] rounded-[12px] px-[10px] transition-colors",
        !active && "hover:bg-accent/60",
      )}
    >
      {active && (
        <motion.span
          layoutId="doc-material-active"
          transition={SPRING}
          className="absolute inset-0 rounded-[12px] bg-nav-active shadow-soft"
        />
      )}
      <span className="relative">
        <FileBadge kind={m.kind} />
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col gap-px whitespace-nowrap">
        <span className="truncate text-[13px] font-medium text-foreground">{m.name}</span>
        <span
          className={cn(
            "text-[11px]",
            m.status === "embedding" ? "text-orange-foreground" : "text-muted-foreground",
          )}
        >
          {materialMeta(m)}
        </span>
      </span>
    </Link>
  );
}
