import { ImageThread } from "@/components/image/image-thread";
import { getImageThread } from "@/services/images";

/** Figma "06 · Image · Prompt approval" */
export default async function ImagePage() {
  const thread = await getImageThread();
  return <ImageThread thread={thread} />;
}
