import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DocumentWorkspace } from "@/components/documents/document-workspace";
import {
  getDocumentThread,
  getMaterial,
  getMaterialPage,
  getMaterials,
} from "@/services/documents";

/** Figma "05 · Documents · Material open" (Light 2:9252 / Dark 2:10833). */
export default function MaterialOpenPage({ params }: PageProps<"/documents/[id]">) {
  // URL data is read inside Suspense so navigations between materials stay instant.
  return (
    <Suspense fallback={null}>
      <MaterialOpen params={params} />
    </Suspense>
  );
}

async function MaterialOpen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [material, page, thread, materials] = await Promise.all([
    getMaterial(id),
    getMaterialPage(id),
    getDocumentThread(id),
    getMaterials(),
  ]);
  if (!material) notFound();

  return (
    <DocumentWorkspace
      key={material.id}
      material={material}
      page={page}
      thread={thread}
      materials={materials}
    />
  );
}

export async function generateStaticParams() {
  const materials = await getMaterials();
  return materials.map((m) => ({ id: m.id }));
}
