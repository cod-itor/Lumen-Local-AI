import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ImageGallery } from "@/components/image/image-gallery";
import { getGeneratedImage, getGeneratedImageIds, getImageGallery } from "@/services/images";

export async function generateStaticParams() {
  const ids = await getGeneratedImageIds();
  return ids.map((id) => ({ id }));
}

/**
 * Figma "07 · Image · Generated images" — [id] is the selected image.
 * The id-dependent part sits behind Suspense so the app shell stays instant.
 */
export default function GeneratedImagesPage({ params }: PageProps<"/image/[id]">) {
  return (
    <Suspense fallback={null}>
      <Gallery params={params} />
    </Suspense>
  );
}

async function Gallery({ params }: { params: PageProps<"/image/[id]">["params"] }) {
  const { id } = await params;
  const [gallery, image] = await Promise.all([getImageGallery(), getGeneratedImage(id)]);
  if (!image) notFound();
  return <ImageGallery gallery={gallery} initialId={id} />;
}
