"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ShellRightPanel } from "@/components/app/right-panel";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { GeneratedImage, ImageGallery as ImageGalleryData } from "@/types/images";
import { ImageTile } from "./image-tile";
import { EASE, riseItem } from "./motion";

/** Figma "07 · Image · Generated images": header, grouped grid, selected-image panel. */
export function ImageGallery({
  gallery,
  initialId,
}: {
  gallery: ImageGalleryData;
  initialId: string;
}) {
  const [selectedId, setSelectedId] = useState(initialId);
  const [panelOpen, setPanelOpen] = useState(true);
  const selected =
    gallery.groups.flatMap((g) => g.images).find((i) => i.id === selectedId) ??
    gallery.groups[0]?.images[0];

  const select = (id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
    // Keep the URL shareable without a navigation (no template re-mount).
    window.history.replaceState(window.history.state, "", `/image/${id}`);
  };

  return (
    <>
      <div className="h-full overflow-y-auto px-5 pt-2 pb-6 [scrollbar-width:none]">
        <div className="flex items-center gap-[10px] whitespace-nowrap">
          <h1 className="text-[22px] font-semibold tracking-[-0.33px] text-foreground">
            Generated images
          </h1>
          <span className="text-[14px] text-subtle">{gallery.total}</span>
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } } }}
          className="mt-[14px] flex w-full max-w-[768px] flex-col gap-[26px]"
        >
          {gallery.groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-[10px]">
              <motion.h2 variants={riseItem} className="text-[13px] font-medium text-muted-foreground">
                {group.label}
              </motion.h2>
              <div className="grid grid-cols-4 gap-[10px]">
                {group.images.map((image) => (
                  <GalleryItem
                    key={image.id}
                    image={image}
                    selected={image.id === selectedId}
                    onSelect={() => select(image.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </motion.div>
      </div>

      <ShellRightPanel open={panelOpen && !!selected} width={300} label="Selected image">
        {selected && <SelectedImagePanel image={selected} onClose={() => setPanelOpen(false)} />}
      </ShellRightPanel>
    </>
  );
}

function GalleryItem({
  image,
  selected,
  onSelect,
}: {
  image: GeneratedImage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      variants={{
        hidden: { opacity: 0, y: 8, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: EASE } },
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE }}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={image.alt}
      className="relative block rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ImageTile image={image} sizes="(max-width: 1100px) 25vw, 184px" />
      {selected && (
        <motion.span
          layoutId="gallery-selection"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
          className="pointer-events-none absolute inset-0 rounded-[16px] border-3 border-brand-orange-strong"
        >
          <span className="absolute top-[7px] right-[10px] flex size-6 items-center justify-center rounded-[12px] bg-brand-orange-strong">
            <Icon name="img-check" size={13} className="text-white" />
          </span>
        </motion.span>
      )}
    </motion.button>
  );
}

const PANEL_ACTIONS = [
  { icon: "img-eraser", label: "Remove BG" },
  { icon: "img-layers", label: "Variations" },
  { icon: "img-imgplus", label: "Reference" },
  { icon: "img-download", label: "Download" },
] as const;

/** Figma "Right Panel · Selected image". */
function SelectedImagePanel({ image, onClose }: { image: GeneratedImage; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col gap-[14px] p-[18px]">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[16px] font-semibold tracking-[-0.08px] text-foreground">
          Selected image
        </h2>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="flex size-[30px] items-center justify-center rounded-[15px] text-icon transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon name="img-x" size={16} />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={image.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="flex flex-col gap-[14px]"
        >
          <ImageTile image={image} sizes="264px" priority className="w-[264px] rounded-[18px]" />
          <p className="text-[12.5px] leading-[18px] text-muted-foreground">{image.prompt}</p>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-2">
        {PANEL_ACTIONS.map((a) =>
          a.label === "Download" ? (
            <a
              key={a.label}
              href={image.src}
              download
              className={actionClass}
            >
              <Icon name={a.icon} size={15} />
              {a.label}
            </a>
          ) : (
            <motion.button key={a.label} type="button" whileTap={{ scale: 0.97 }} className={actionClass}>
              <Icon name={a.icon} size={15} />
              {a.label}
            </motion.button>
          ),
        )}
      </div>
    </div>
  );
}

const actionClass = cn(
  "flex min-w-0 items-center justify-center gap-[6px] rounded-[14px] border border-border px-3 py-[10px]",
  "text-[12.5px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent",
);
