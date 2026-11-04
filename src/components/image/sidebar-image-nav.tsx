"use client";

import { usePathname } from "next/navigation";
import { SidebarHistoryItem, SidebarNavItem, SidebarSection } from "@/components/app/sidebar";
import type { ImageSidebarData } from "@/types/images";

/** Client half of the image sidebar: nav items + Recents with active highlight. */
export function ImageSidebarNav({ data }: { data: ImageSidebarData }) {
  const pathname = usePathname();
  // Any /image/[id] is the gallery (07), so "Generated images" owns the highlight there.
  const galleryActive = pathname.startsWith("/image/");

  return (
    <>
      <SidebarNavItem href={data.newImageHref} icon="nav-plus" label="New image" />
      <SidebarNavItem icon="nav-search" label="Search" />
      <SidebarNavItem
        href={data.galleryHref}
        icon="img-images"
        label="Generated images"
        active={galleryActive}
      />
      <SidebarSection title="Recents">
        {data.recents.map((r) => (
          <SidebarHistoryItem
            key={r.id}
            href={r.href}
            label={r.title}
            active={!galleryActive && pathname === r.href}
          />
        ))}
      </SidebarSection>
    </>
  );
}
