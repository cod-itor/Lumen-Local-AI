import { AppShell } from "@/components/app/app-shell";
import { DocumentsSidebarBody } from "@/components/documents/sidebar-documents";
import { ImageSidebarBody } from "@/components/image/sidebar-image";
import { getMaterials } from "@/services/documents";
import {
  getChatHistory,
  getCurrentUser,
  getModelStatuses,
  getSectionModels,
} from "@/services/app";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, chatHistory, sectionModels, modelStatuses, materials] = await Promise.all([
    getCurrentUser(),
    getChatHistory(),
    getSectionModels(),
    getModelStatuses(),
    getMaterials(),
  ]);

  // Where each tab goes before the user has visited it (direct links, no redirect hop).
  const tabHomes = {
    chat: "/chat",
    documents: materials[0] ? `/documents/${materials[0].id}` : "/documents",
    image: "/image",
  };

  // Section-specific sidebar bodies. Each is an async server component that loads
  // its own data from src/services, so it can fetch the API later.
  const sidebars = {
    documents: <DocumentsSidebarBody />,
    image: <ImageSidebarBody />,
  };

  return (
    <AppShell data={{ user, chatHistory, sectionModels, modelStatuses, sidebars, tabHomes }}>
      {children}
    </AppShell>
  );
}
