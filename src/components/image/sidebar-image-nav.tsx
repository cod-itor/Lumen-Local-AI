"use client";

import { usePathname } from "next/navigation";
import { SidebarHistoryItem, SidebarNavItem, SidebarSection } from "@/components/app/sidebar";
import { useMessages } from "@/i18n/provider";
import type { ImageSidebarData } from "@/types/images";

/** Client half of the image sidebar: nav items + Recents with active highlight. */
export function ImageSidebarNav({ data }: { data: ImageSidebarData }) {
  const pathname = usePathname();
  // Any /image/[id] is the gallery (07), so "Generated images" owns the highlight there.
  const galleryActive = pathname.startsWith("/image/");
  const m = useMessages().app.sidebar;

  return (
    <>
      <SidebarNavItem href={data.newImageHref} icon="nav-plus" label={m.newImage} />
      <SidebarNavItem icon="nav-search" label={m.search} />
      <SidebarNavItem
        href={data.galleryHref}
        icon="img-images"
        label={m.generatedImages}
        active={galleryActive}
      />
      <SidebarSection title={m.recents}>
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
