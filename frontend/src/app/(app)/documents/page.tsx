import { redirect } from "next/navigation";
import { getMaterials } from "@/services/documents";

/** /documents opens the first shared material (Figma "05 · Documents · Material open"). */
export default async function DocumentsPage() {
  const [first] = await getMaterials();
  if (!first) return null;
  redirect(`/documents/${first.id}`);
}
