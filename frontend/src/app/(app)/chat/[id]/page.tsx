import { Suspense } from "react";
import { ChatThreadFallback } from "@/components/chat/chat-thread";
import { LiveChatThread } from "@/components/chat/live-chat-thread";

/** Chat ids are only known at runtime (the shell reads the pathname), so this route renders on request. */
export const instant = false;

/** Figma "02 · Chat · Answer" with live data: the thread loads in the browser through the /api proxy. */
export default function ChatPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<ChatThreadFallback />}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: PageProps<"/chat/[id]">["params"] }) {
  const { id } = await params;
  return <LiveChatThread key={id} chatId={id} />;
}
