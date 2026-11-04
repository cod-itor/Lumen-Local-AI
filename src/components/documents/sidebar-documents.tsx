import { getDocumentChats, getMaterials } from "@/services/documents";
import { DocumentsSidebarList } from "./sidebar-documents-list";

/** Body of Figma "Left Sidebar · Documents" (2:9255). Loads its data on the server. */
export async function DocumentsSidebarBody() {
  const [materials, chats] = await Promise.all([getMaterials(), getDocumentChats()]);
  return <DocumentsSidebarList materials={materials} chats={chats} />;
}
