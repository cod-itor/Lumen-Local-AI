import { getImageSidebar } from "@/services/images";
import { ImageSidebarNav } from "./sidebar-image-nav";

/** Body of Figma "Left Sidebar · Image" (2:9463). Loads its data on the server. */
export async function ImageSidebarBody() {
  const data = await getImageSidebar();
  return <ImageSidebarNav data={data} />;
}
