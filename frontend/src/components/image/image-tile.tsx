import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GeneratedImage } from "@/types/images";

/** Figma "Image Tile": rounded square artwork. Size comes from the parent / className. */
export function ImageTile({
  image,
  className,
  sizes,
  priority,
}: {
  image: GeneratedImage;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-[16px]", className)}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        // Mock artwork is SVG; drop this once the API serves raster images.
        unoptimized
        className="object-cover"
      />
    </div>
  );
}
