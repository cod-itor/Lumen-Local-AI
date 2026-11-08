import { AppShell } from "@/components/app/app-shell";
import { DocumentsSidebarList } from "@/components/documents/sidebar-documents-list";
import { ImageSidebarBody } from "@/components/image/sidebar-image";
import {
  getChatHistory,
  getCurrentUser,
  getModelStatuses,
  getSectionModels,
} from "@/services/app";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, chatHistory, sectionModels, modelStatuses] = await Promise.all([
    getCurrentUser(),
    getChatHistory(),
    getSectionModels(),
    getModelStatuses(),
  ]);

  // Where each tab goes before the user has visited it (direct links, no redirect hop).
  const tabHomes = {
    chat: "/chat",
    documents: "/documents",
    image: "/image",
  };

  // Section-specific sidebar bodies (both live).
  const sidebars = {
    documents: <DocumentsSidebarList />,
    image: <ImageSidebarBody />,
  };

  return (
    <AppShell data={{ user, chatHistory, sectionModels, modelStatuses, sidebars, tabHomes }}>
      {children}
    </AppShell>
  );
}
