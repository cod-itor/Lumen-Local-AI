"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "@/components/app/composer";
import { useMessages, useTranslate } from "@/i18n/provider";
import { api, ApiError } from "@/lib/api";
import { activePath, deepestLeaf, siblingsOf } from "@/lib/chat-tree";
import { takePendingPrompt } from "@/lib/harness/pending";
import { useHarnessTurn, type TurnFailure } from "@/lib/harness/useHarnessTurn";
import { useSession } from "@/lib/session";
import type { ChatDto, ChatMessagesResponse, HarnessTurnRequest, MessageDto, SourceDto } from "@/types/api";
import { riseItem } from "./assistant-answer";
import { LiveAssistantMessage, StreamingReply } from "./live-message";

type Loaded = { messages: MessageDto[]; leaf: string | null };

/** The Chat tab with the real backend (FRONTEND.md §7.3): load the tree, show the active branch, run turns. */
export function LiveChatThread({
  chatId,
  composer,
  header,
  onCite,
  onChat,
}: {
  chatId: string;
  /** Composer overrides (Documents: placeholder, no Search chip, attach button, source picker chip). */
  composer?: Partial<React.ComponentProps<typeof Composer>>;
  /** Shown above the messages (Documents: the "Using n of m materials" pill). */
  header?: React.ReactNode;
  onCite?: (source: SourceDto) => void;
  /** Called with the refreshed chat after each turn (defaults to the Chat-tab history). */
  onChat?: (chat: ChatDto) => void;
}) {
  const router = useRouter();
  const session = useSession();
  const m = useMessages();
  const t = useTranslate();
  const live = m.app.chat.live;
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [failure, setFailure] = useState<TurnFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { ui, start, stop, busy } = useHarnessTurn();
  const scrollRef = useRef<HTMLDivElement>(null);
  const showSpeed = session.me?.settings.showSpeedStats ?? true;

  const load = useCallback(async () => {
    try {
      const r = await api.get<ChatMessagesResponse>(`/api/chats/${chatId}/messages`);
      setData({ messages: r.messages, leaf: r.activeLeafId });
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", ""));
    }
  }, [chatId]);

  const scrollDown = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));

  const add = (msg: MessageDto) => {
    setData((d) => (d ? { messages: [...d.messages.filter((x) => x.id !== msg.id), msg], leaf: msg.id } : d));
    scrollDown();
  };

  const run = useCallback(
    async (req: Omit<HarnessTurnRequest, "task" | "providerId" | "chatId">, userText: string | null) => {
      const provider = session.provider;
      if (!provider) {
        setNotice(live.noModel);
        return;
      }
      setFailure(null);
      setNotice(null);
      setPendingUser(userText);
      scrollDown();
      await start(
        { task: "MESSAGE", providerId: provider.id, chatId, ...req },
        {
          onUserMessage: (u) => {
            setPendingUser(null);
            add(u);
          },
          onAssistantMessage: add,
          onReload: () => void load(),
          onFailure: (f) => {
            setPendingUser(null);
            setFailure(f);
          },
          onCancelled: () => {
            setPendingUser(null);
            setNotice(live.cancelled);
          },
        },
        provider,
      );
      setPendingUser(null);
      api.get<ChatDto>(`/api/chats/${chatId}`).then(onChat ?? session.touchChat).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, session.provider, start, load, onChat],
  );

  // Load once, then send the prompt typed on /chat (if any).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load().then(() => {
      const p = takePendingPrompt(chatId);
      if (p) void run({ content: p.text, webSearch: p.webSearch }, p.text);
    });
  }, [chatId, load, run]);

  const path = useMemo(() => (data ? activePath(data.messages, data.leaf) : []), [data]);
  const last = path[path.length - 1];
  const unanswered = last?.role === "USER" ? last : null;

  const switchVersion = async (msg: MessageDto, delta: -1 | 1) => {
    if (!data) return;
    const sibs = siblingsOf(data.messages, msg);
    const next = sibs[sibs.findIndex((s) => s.id === msg.id) + delta];
    if (!next) return;
    const leaf = deepestLeaf(data.messages, next.id);
    setData({ ...data, leaf });
    await api.patch(`/api/chats/${chatId}`, { activeLeafId: leaf }).catch(() => undefined);
  };

  if (loadError) {
    return (
      <Centered>
        <p className="text-[14px] text-muted-foreground">{loadError.status === 404 ? live.notFound : live.loadFailed}</p>
        <button type="button" onClick={() => (loadError.status === 404 ? router.push("/chat") : void load())} className="text-[13px] font-medium underline">
          {loadError.status === 404 ? m.app.sidebar.newChat : live.retry}
        </button>
      </Centered>
    );
  }

  const stageLabel =
    ui.phase === "loadingModel"
      ? t("app.chat.live.loadingModel", { pct: String(Math.round((ui.modelProgress?.p ?? 0) * 100)) })
      : ui.retryReason === "EMPTY"
      ? live.tryAgain
      : ui.retryReason === "INVALID"
        ? live.fixing
        : ui.stage && ui.stage !== "GENERATING"
          ? t(`app.chat.live.stages.${ui.stage}`, { detail: ui.stageDetail ?? "" })
          : ui.text
            ? null
            : m.app.chat.thinking;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="mx-auto flex w-[min(var(--chat-width),calc(100%-108px))] flex-col gap-7 pt-3 pb-8 max-sm:w-[calc(100%-32px)]"
        >
          {header}
          {path.map((msg) =>
            msg.role === "USER" ? (
              <Fragment key={msg.id}>
                <UserBubble text={msg.content} />
              </Fragment>
            ) : (
              <LiveAssistantMessage
                key={msg.id}
                message={msg}
                busy={busy}
                showSpeed={showSpeed}
                onCite={onCite}
                version={versionOf(data?.messages ?? [], msg)}
                onVersion={(d) => void switchVersion(msg, d)}
                onRegenerate={() => void run({ regenerateOf: msg.id }, null)}
              />
            ),
          )}
          {pendingUser && <UserBubble text={pendingUser} />}
          {busy && <StreamingReply text={ui.text} stageLabel={stageLabel} />}
          {ui.phase === "loadingModel" && (
            <div className="-mt-4 flex w-full max-w-[360px] flex-col gap-1.5">
              <span className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <span
                  className="bg-brand-gradient block h-full rounded-full transition-[width]"
                  style={{ width: `${Math.round((ui.modelProgress?.p ?? 0) * 100)}%` }}
                />
              </span>
              <span className="text-[12px] text-muted-foreground">{live.loadingModelFirst}</span>
            </div>
          )}
          {!busy && (failure || (unanswered && !pendingUser)) && (
            <motion.div variants={riseItem} className="flex flex-col items-start gap-2">
              <p className="text-[13.5px] text-muted-foreground">
                {notice ?? failureText(failure, live)}
              </p>
              {failure?.code === "PROVIDER_ERROR" && (
                <Link href="/settings/models" className="text-[12.5px] font-medium underline underline-offset-2">
                  {live.checkModels}
                </Link>
              )}
              {(failure?.retryable ?? true) && unanswered && (
                <button
                  type="button"
                  onClick={() => void run({ answerOf: unanswered.id }, null)}
                  className="rounded-full border border-border px-3 py-[6px] text-[12.5px] font-medium text-foreground hover:bg-accent"
                >
                  {live.retry}
                </button>
              )}
            </motion.div>
          )}
          {!busy && !failure && !unanswered && notice && <p className="text-[13.5px] text-muted-foreground">{notice}</p>}
        </motion.div>
      </div>

      <div className="mx-auto w-[min(calc(var(--chat-width)+20px),calc(100%-88px))] shrink-0 pt-3 max-sm:w-[calc(100%-16px)]">
        <Composer
          placeholder={m.app.chat.followUpPlaceholder}
          defaultSearchOn={false}
          busy={busy}
          onStop={() => void stop()}
          onSubmit={(text, o) => void run({ content: text, webSearch: o.webSearch }, text)}
          {...composer}
        />
        <p className="mt-[9px] -mb-[5px] text-center text-[11.5px] leading-[14px] text-placeholder">{m.common.aiDisclaimer}</p>
      </div>
    </div>
  );
}

type LiveMessages = ReturnType<typeof useMessages>["app"]["chat"]["live"];

function failureText(f: TurnFailure | null, live: LiveMessages) {
  if (!f) return live.noAnswer;
  if (f.code === "PROVIDER_ERROR") return live.providerErrors[f.providerError ?? "GENERIC"];
  if (f.code === "TURN_EXPIRED") return live.expired;
  if (f.code === "STREAM_INTERRUPTED") return live.connectionLost;
  return f.message || live.noAnswer;
}

function versionOf(all: MessageDto[], msg: MessageDto) {
  const sibs = siblingsOf(all, msg);
  return { index: Math.max(0, sibs.findIndex((s) => s.id === msg.id)), count: sibs.length };
}

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div variants={riseItem} initial="hidden" animate="show" className="flex w-full justify-end">
      <p className="max-w-[85%] rounded-[22px] bg-surface-muted px-[18px] py-[11px] text-[15px] leading-[22px] whitespace-pre-wrap text-foreground">
        {text}
      </p>
    </motion.div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">{children}</div>;
}
