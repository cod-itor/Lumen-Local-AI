import { Suspense } from "react";
import { DocumentWorkspace } from "@/components/documents/document-workspace";

/** Document ids are only known at runtime, so this route renders on request. */
export const instant = false;

/** Figma "05 · Documents · Material open" (Light 2:9252 / Dark 2:10833) with live data. */
export default function MaterialOpenPage({ params, searchParams }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={null}>
      <MaterialOpen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function MaterialOpen({
  params,
  searchParams,
}: {
  params: PageProps<"/documents/[id]">["params"];
  searchParams: PageProps<"/documents/[id]">["searchParams"];
}) {
  const { id } = await params;
  const { chat } = await searchParams;
  const chatParam = typeof chat === "string" ? chat : null;
  return <DocumentWorkspace key={`${id}:${chatParam ?? ""}`} documentId={id} chatParam={chatParam} />;
}
