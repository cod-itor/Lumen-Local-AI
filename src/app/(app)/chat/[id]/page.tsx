import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatThread, ChatThreadFallback } from "@/components/chat/chat-thread";
import { getChatHistory } from "@/services/app";
import { getConversation } from "@/services/chat";

/** Prerender every history conversation (also lets the shell's `usePathname()` resolve). */
export async function generateStaticParams() {
  return (await getChatHistory()).map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/chat/[id]">): Promise<Metadata> {
  const conversation = await getConversation((await params).id);
  return { title: conversation?.title ?? "Chat" };
}

/**
 * Figma "02 · Chat · Answer". The deep link `?sources=open` opens the sources
 * panel ("03 · Chat · Sources open"); it's read on the client.
 * The URL-specific thread sits behind Suspense so the App Shell stays instant.
 */
export default function ChatPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<ChatThreadFallback />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: PageProps<"/chat/[id]">["params"] }) {
  const conversation = await getConversation((await params).id);
  if (!conversation) notFound();
  return <ChatThread key={conversation.id} conversation={conversation} />;
}
