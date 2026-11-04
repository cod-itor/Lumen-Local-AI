import { AppShell } from "@/components/app/app-shell";
import { DocumentsSidebarBody } from "@/components/documents/sidebar-documents";
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

  // Section-specific sidebar bodies. Each is an async server component that loads
  // its own data from src/services, so it can fetch the API later.
  const sidebars = {
    documents: <DocumentsSidebarBody />,
    image: <ImageSidebarBody />,
  };

  return (
    <AppShell data={{ user, chatHistory, sectionModels, modelStatuses, sidebars }}>
      {children}
    </AppShell>
  );
}
