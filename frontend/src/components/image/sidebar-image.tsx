"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SidebarHistoryItem, SidebarNavItem, SidebarSection } from "@/components/app/sidebar";
import { useMessages } from "@/i18n/provider";
import { useImages } from "@/lib/images";

/** Body of Figma "Left Sidebar · Image" (2:9463): New image + the user's image sessions. */
export function ImageSidebarBody() {
  return (
    <Suspense fallback={null}>
      <Body />
    </Suspense>
  );
}

function Body() {
  const pathname = usePathname();
  const current = useSearchParams().get("s");
  const router = useRouter();
  const m = useMessages().app;
  const store = useImages();
  const onImage = pathname.startsWith("/image");

  return (
    <>
      <SidebarNavItem href="/image" icon="nav-plus" label={m.sidebar.newImage} />
      <SidebarSection title={m.sidebar.recents}>
        {store.sessions.map((s) => (
          <SidebarHistoryItem
            key={s.id}
            href={`/image?s=${s.id}`}
            label={s.title}
            active={onImage && current === s.id}
            trailing={
              <span
                role="button"
                tabIndex={0}
                aria-label={m.image.live.deleteSession}
                title={m.image.live.deleteSession}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void store.remove(s.id).then(() => current === s.id && router.push("/image"));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    void store.remove(s.id).then(() => current === s.id && router.push("/image"));
                  }
                }}
                className="ml-auto hidden size-[22px] items-center justify-center rounded-[11px] text-icon group-hover:flex hover:bg-accent"
              >
                ×
              </span>
            }
          />
        ))}
      </SidebarSection>
    </>
  );
}
