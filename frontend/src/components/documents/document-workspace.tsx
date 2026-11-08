"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Composer } from "@/components/app/composer";
import { ShellRightPanel } from "@/components/app/right-panel";
import { LiveChatThread } from "@/components/chat/live-chat-thread";
import { format } from "@/i18n/messages";
import { useMessages } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { chatFor, toMaterial, useDocuments } from "@/lib/documents";
import { setPendingPrompt } from "@/lib/harness/pending";
import type { ChatDto, SourceDto } from "@/types/api";
import { FileViewer, type ViewerFocus } from "./file-viewer";
import { SourcePicker } from "./source-picker";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Figma "05 · Documents · Material open" with live data (FRONTEND.md §7.4): the DOCS chat for this file, the
 * source picker (the chat's documentIds) and the file viewer that opens each citation at its passage.
 */
export function DocumentWorkspace({ documentId, chatParam }: { documentId: string; chatParam: string | null }) {
  const msgs = useMessages();
  const m = msgs.app.documents;
  const docs = useDocuments();
  const doc = docs.documents.find((d) => d.id === documentId) ?? null;
  const chat =
    (chatParam ? docs.chats.find((c) => c.id === chatParam) : null) ?? chatFor(docs.chats, documentId);
  const [startedChat, setStartedChat] = useState<string | null>(null);
  const chatId = chat?.id ?? startedChat;
  const [draftSources, setDraftSources] = useState<string[]>([documentId]);
  const sources = chat?.documentIds.length ? chat.documentIds : draftSources;
  const [viewerOpen, setViewerOpen] = useState(true);
  const [viewDoc, setViewDoc] = useState(documentId);
  const [focus, setFocus] = useState<ViewerFocus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownDoc = docs.documents.find((d) => d.id === viewDoc) ?? doc;
  const materials = docs.documents.map((d) => toMaterial(d, docs.progress[d.id]));
  const ready = doc?.status === "READY";

  const changeSources = async (ids: string[]) => {
    if (!chat) {
      setDraftSources(ids);
      return;
    }
    try {
      const updated = await api.patch<ChatDto>(`/api/chats/${chat.id}`, { documentIds: ids });
      docs.touchChat(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.library.errors.GENERIC);
    }
  };

  const openSource = useCallback((src: SourceDto) => {
    if (!src.documentId) return;
    setViewDoc(src.documentId);
    setViewerOpen(true);
    setFocus((f) => ({ chunkId: src.chunkId, page: src.page, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);

  const picker = (variant: "pill" | "chip") => (
    <SourcePicker
      materials={materials}
      selected={sources}
      currentId={documentId}
      onChange={(ids) => void changeSources(ids)}
      variant={variant}
    />
  );

  const composer = {
    placeholder: m.placeholder,
    showSearch: false,
    attachIcon: "doc-clip",
    attachLabel: m.attach,
    onAttach: docs.pick,
    leading: picker("chip"),
  };

  // First message: create the DOCS chat with the picked files, then the thread sends the prompt.
  const firstSend = async (text: string) => {
    if (!ready) {
      setError(m.library.notReady);
      return;
    }
    try {
      const created = await api.post<ChatDto>("/api/chats", { tab: "DOCS", documentIds: sources });
      setPendingPrompt(created.id, text, false);
      docs.touchChat(created);
      setStartedChat(created.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : m.library.errors.GENERIC);
    }
  };

  if (!docs.loaded) return null;
  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[14px] text-muted-foreground">{m.library.notFound}</p>
        <Link href="/documents" className="text-[13px] font-medium underline">
          {m.library.title}
        </Link>
      </div>
    );
  }

  const viewer = shownDoc && (
    <ShellRightPanel
      open={viewerOpen}
      width={540}
      label={m.viewer.panel}
      panelId="File viewer"
      className="overflow-hidden"
      onClose={() => setViewerOpen(false)}
    >
      <FileViewer key={shownDoc.id} document={shownDoc} focus={focus} onClose={() => setViewerOpen(false)} />
    </ShellRightPanel>
  );

  const notice = (error || docs.notice) && (
    <p role="status" className="text-center text-[12.5px] text-orange-foreground">
      {error ?? docs.notice}
    </p>
  );

  if (chatId) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          <LiveChatThread
            key={chatId}
            chatId={chatId}
            composer={composer}
            header={
              <div className="flex flex-col items-center gap-2">
                {picker("pill")}
                {notice}
              </div>
            }
            onCite={openSource}
            onChat={docs.touchChat}
          />
        </div>
        {viewer}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center px-[14px]">
      <div className="min-h-0 w-full flex-1 overflow-y-auto [scrollbar-width:none]">
        <div className="mx-auto flex w-full max-w-(--chat-width) flex-col gap-7 pt-3 pb-6">
          <div className="flex justify-center">{picker("pill")}</div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-col items-center gap-2 pt-24 text-center"
          >
            <span className="text-[20px] font-semibold tracking-[-0.5px] text-foreground">
              {format(m.askAbout, { name: doc.filename })}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {doc.status === "FAILED" ? m.library.failedHint : ready ? m.askHint : m.library.notReady}
            </span>
            {notice}
          </motion.div>
        </div>
      </div>

      <div className="w-full max-w-[calc(var(--chat-width)+20px)] pt-3">
        <Composer {...composer} onSubmit={(text) => void firstSend(text)} />
      </div>
      <p className="mt-[6px] -mb-[5px] text-center text-[11.5px] leading-[14px] text-subtle">{msgs.common.aiDisclaimer}</p>
      {viewer}
    </div>
  );
}
