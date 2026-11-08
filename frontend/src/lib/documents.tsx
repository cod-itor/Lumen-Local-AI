"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMessages } from "@/i18n/provider";
import { api, ApiError, apiFetch } from "@/lib/api";
import { readSse } from "@/lib/sse";
import type { ChatDto, DocumentDto, ErrorEvent, JobDto, PageResponse, UploadResponse } from "@/types/api";
import type { FileKind, Material } from "@/types/documents";

/**
 * The Documents tab's live data (FRONTEND.md §7.4): the library, the DOCS-tab chats, uploads with job progress.
 * Lives in the app shell so the sidebar and the workspace share it.
 */
type Docs = {
  documents: DocumentDto[];
  chats: ChatDto[];
  loaded: boolean;
  /** 0–1 while a document is being indexed in this session. */
  progress: Record<string, number>;
  upload: (file: File) => Promise<UploadResponse>;
  cancel: (documentId: string) => Promise<void>;
  remove: (documentId: string) => Promise<void>;
  touchChat: (chat: ChatDto) => void;
  reload: () => Promise<void>;
  /** Open the file picker; the chosen file is uploaded and opened. */
  pick: () => void;
  /** Upload a dropped/chosen file, show errors as `notice`, open it on success. */
  uploadAndOpen: (file: File) => Promise<void>;
  uploading: string | null;
  notice: string | null;
  clearNotice: () => void;
};

export const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

const Ctx = createContext<Docs | null>(null);
const OPEN = new Set(["UPLOADED", "PARSING", "EMBEDDING"]);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [chats, setChats] = useState<ChatDto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const jobs = useRef(new Map<string, string>()); // documentId → jobId
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const lib = useMessages().app.documents.library;
  const [uploading, setUploading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [d, c] = await Promise.all([
      api.get<PageResponse<DocumentDto>>("/api/documents?size=100"),
      api.get<PageResponse<ChatDto>>("/api/chats?tab=DOCS&size=50"),
    ]);
    setDocuments(d.items);
    setChats(c.items);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<PageResponse<DocumentDto>>("/api/documents?size=100"),
      api.get<PageResponse<ChatDto>>("/api/chats?tab=DOCS&size=50"),
    ])
      .then(([d, c]) => {
        if (!alive) return;
        setDocuments(d.items);
        setChats(c.items);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const refreshOne = useCallback(async (id: string) => {
    const d = await api.get<DocumentDto>(`/api/documents/${id}`).catch(() => null);
    if (d) setDocuments((list) => list.map((x) => (x.id === id ? d : x)));
    return d;
  }, []);

  /** Follow a job's events; if the stream drops, read the job once and resubscribe while it is open. */
  const follow = useCallback(
    async (documentId: string, jobId: string) => {
      jobs.current.set(documentId, jobId);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await apiFetch(`/api/jobs/${jobId}/events`, { headers: { Accept: "text/event-stream" } });
          for await (const { event, data } of readSse(res)) {
            if (event === "progress") {
              const p = (data as { progress: number }).progress;
              setProgress((m) => ({ ...m, [documentId]: p }));
            } else if (event === "done" || event === "error") {
              if (event === "error") void (data as ErrorEvent);
              break;
            }
          }
        } catch {
          // fall through to the status check below
        }
        const job = await api.get<JobDto>(`/api/jobs/${jobId}`).catch(() => null);
        if (!job || job.status !== "QUEUED" && job.status !== "RUNNING") break;
      }
      jobs.current.delete(documentId);
      setProgress((m) => {
        const n = { ...m };
        delete n[documentId];
        return n;
      });
      await refreshOne(documentId);
    },
    [refreshOne],
  );

  // After a page reload there is no job id: poll open documents every 2 s until they finish.
  useEffect(() => {
    const open = documents.filter((d) => OPEN.has(d.status) && !jobs.current.has(d.id));
    if (open.length === 0) return;
    const t = setInterval(() => open.forEach((d) => void refreshOne(d.id)), 2000);
    return () => clearInterval(t);
  }, [documents, refreshOne]);

  const upload = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/documents", { method: "POST", body: form });
      const r = (await res.json()) as UploadResponse;
      setDocuments((list) => [r.document, ...list.filter((d) => d.id !== r.document.id)]);
      if (r.jobId) {
        setProgress((m) => ({ ...m, [r.document.id]: 0 }));
        void follow(r.document.id, r.jobId);
      }
      return r;
    },
    [follow],
  );

  const uploadAndOpen = useCallback(
    async (file: File) => {
      setNotice(null);
      setUploading(file.name);
      try {
        const r = await upload(file);
        if (r.duplicate) setNotice(lib.duplicate);
        router.push(`/documents/${r.document.id}`);
      } catch (e) {
        const code = uploadErrorCode(e) as keyof typeof lib.errors;
        setNotice(lib.errors[code] ?? lib.errors.GENERIC);
      } finally {
        setUploading(null);
      }
    },
    [upload, router, lib],
  );

  const value = useMemo<Docs>(
    () => ({
      documents,
      chats,
      loaded,
      progress,
      upload,
      uploadAndOpen,
      uploading,
      notice,
      clearNotice: () => setNotice(null),
      pick: () => input.current?.click(),
      cancel: async (documentId) => {
        const jobId = jobs.current.get(documentId);
        if (jobId) await api.post(`/api/jobs/${jobId}/cancel`).catch(() => undefined);
      },
      remove: async (documentId) => {
        await api.del(`/api/documents/${documentId}`);
        setDocuments((list) => list.filter((d) => d.id !== documentId));
        setChats((list) =>
          list.map((c) => ({ ...c, documentIds: c.documentIds.filter((id) => id !== documentId) })),
        );
      },
      touchChat: (chat) => setChats((list) => [chat, ...list.filter((c) => c.id !== chat.id)]),
      reload,
    }),
    [documents, chats, loaded, progress, upload, uploadAndOpen, uploading, notice, reload],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadAndOpen(f);
        }}
      />
    </Ctx.Provider>
  );
}

export function useDocuments() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDocuments must be used inside <DocumentsProvider>");
  return ctx;
}

export function fileKind(d: Pick<DocumentDto, "filename" | "mime">): FileKind {
  const ext = d.filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || d.mime === "application/pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "md") return "md";
  return "txt";
}

/** Live document → the sidebar/picker's Material shape. */
export function toMaterial(d: DocumentDto, progress?: number): Material {
  return {
    id: d.id,
    name: d.filename,
    kind: fileKind(d),
    pages: d.pages ?? undefined,
    status: d.status === "READY" ? "ready" : d.status === "FAILED" ? "failed" : "embedding",
    progress: d.status === "READY" ? undefined : Math.round((progress ?? 0) * 100),
    error: d.error ?? undefined,
  };
}

/** The most recent DOCS chat that searches this document. */
export function chatFor(chats: ChatDto[], documentId: string) {
  return chats.find((c) => c.documentIds.includes(documentId)) ?? null;
}

export const uploadErrorCode = (e: unknown) => (e instanceof ApiError ? e.code : "NETWORK_ERROR");
