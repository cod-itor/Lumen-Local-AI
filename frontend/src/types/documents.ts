/** Documents tab view types (Figma "05 · Documents · Material open"); live data maps into them via lib/documents. */

export type FileKind = "pdf" | "docx" | "md" | "txt";

/** A study material in the sidebar and source picker. */
export type Material = {
  id: string;
  name: string; // "Biology_Ch2_Cells.pdf"
  kind: FileKind;
  pages?: number;
  sharedBy?: string;
  status: "ready" | "embedding" | "failed";
  /** 0–100 while `status === "embedding"`. */
  progress?: number;
  /** Why indexing failed (user-safe text from the backend). */
  error?: string;
};
