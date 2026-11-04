/**
 * Documents section domain types (Figma "05 · Documents · Material open").
 * Mocks in src/mocks/documents.ts and services in src/services/documents.ts
 * both conform to these.
 */

export type FileKind = "pdf" | "docx" | "md" | "txt";

/** A study material shared with the student (sidebar "Shared materials"). */
export type Material = {
  id: string;
  name: string; // "Biology_Ch2_Cells.pdf"
  kind: FileKind;
  pages?: number;
  sharedBy?: string; // "Ms. Dara"
  status: "ready" | "embedding";
  /** 0–100 while `status === "embedding"`. */
  progress?: number;
};

/** Sidebar "Recents" row: a document chat bound to one material. */
export type DocumentChatSummary = {
  id: string;
  title: string;
  materialId: string;
};

/** One block of a rendered document page. `highlight` blocks are citation targets. */
export type PageBlock =
  | { type: "eyebrow" | "title" | "heading" | "paragraph"; text: string }
  | { type: "highlight"; id: string; text: string };

export type MaterialPage = {
  materialId: string;
  page: number;
  blocks: PageBlock[];
};

export type RichSpan = { text: string; bold?: boolean };

/** Assistant answer source chip: points at a highlighted passage in a page. */
export type Citation = {
  id: string;
  materialId: string;
  fileName: string; // chip label: "Biology_Ch2_Cells.pdf · p.3"
  page: number;
  highlightId: string;
};

export type FollowUp = { id: string; label: string; icon?: "upload" };

export type DocumentMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      content: RichSpan[];
      citations?: Citation[];
      /** Copy / rate / regenerate / translate row. */
      showActions?: boolean;
      followUps?: FollowUp[];
    };

export type DocumentThread = {
  id: string;
  materialId: string;
  /** Materials this chat retrieves from (multi-file RAG). Shown as "Using 2 of 5 materials". */
  materialIds: string[];
  messages: DocumentMessage[];
};
