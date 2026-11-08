"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SidebarNavItem, SidebarSection } from "@/components/app/sidebar";
import { Icon } from "@/components/icon";
import { useMessages } from "@/i18n/provider";
import { toMaterial, useDocuments } from "@/lib/documents";
import { cn } from "@/lib/utils";
import type { Material } from "@/types/documents";
import { FileBadge, useMaterialMeta } from "./file-badge";

const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

/** Body of Figma "Left Sidebar · Documents" (2:9255) with the live library and DOCS chats. */
export function DocumentsSidebarList() {
  return (
    <Suspense fallback={null}>
      <List />
    </Suspense>
  );
}

function List() {
  const pathname = usePathname();
  const chatParam = useSearchParams().get("chat");
  const currentId = pathname.startsWith("/documents/") ? pathname.split("/")[2] : null;
  const m = useMessages().app.sidebar;
  const docs = useDocuments();
  const materials = docs.documents.map((d) => toMaterial(d, docs.progress[d.id]));
  const activeChat = chatParam ?? (currentId ? docs.chats.find((c) => c.documentIds.includes(currentId))?.id : null);

  return (
    <>
      <SidebarNavItem icon="nav-plus" label={m.newDocumentChat} onClick={docs.pick} />
      <SidebarNavItem
        href="/documents"
        icon="doc-book"
        label={m.materials}
        active={pathname === "/documents"}
        trailing={
          <span
            role="button"
            tabIndex={0}
            aria-label={m.newDocumentChat}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              docs.pick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                docs.pick();
              }
            }}
            className="flex size-[26px] items-center justify-center rounded-[13px] text-icon transition-colors hover:bg-accent"
          >
            <Icon name="plus-sm" size={17} />
          </span>
        }
      />

      {materials.length > 0 && (
        <SidebarSection title={m.sharedMaterials}>
          {materials.map((mat) => (
            <MaterialRow key={mat.id} material={mat} active={mat.id === currentId} />
          ))}
        </SidebarSection>
      )}
      {docs.chats.length > 0 && (
        <SidebarSection title={m.recents}>
          {docs.chats.map((c) => {
            const active = c.id === activeChat;
            const href = c.documentIds[0] ? `/documents/${c.documentIds[0]}?chat=${c.id}` : "/documents";
            return (
              <Link
                key={c.id}
                href={href}
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
                <span className="relative min-w-0 flex-1 truncate text-[13.5px] text-foreground-secondary">{c.title}</span>
              </Link>
            );
          })}
        </SidebarSection>
      )}
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
            "truncate text-[11px]",
            m.status === "embedding" ? "text-orange-foreground" : m.status === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {materialMeta(m)}
        </span>
      </span>
    </Link>
  );
}
