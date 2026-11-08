"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Folder, FolderMinus, FolderPlus, MoreHorizontal, Pencil, Pin, PinOff, Search, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/i18n/provider";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { ChatDto, PageResponse, ProjectDto } from "@/types/api";
import { SidebarHistoryItem, SidebarNavItem, SidebarSection } from "./sidebar";

type Prompt =
  | { kind: "renameChat"; chat: ChatDto }
  | { kind: "deleteChat"; chat: ChatDto }
  | { kind: "newProject"; moveChat?: ChatDto }
  | { kind: "renameProject"; project: ProjectDto }
  | { kind: "deleteProject"; project: ProjectDto };

/** Body of Figma "Left Sidebar · Chat" (used by /chat and /learn): live chats, search, projects and pins. */
export function ChatSidebarBody() {
  const pathname = usePathname();
  const m = useMessages().app.sidebar;
  const { chats, projects, loading } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const pinned = chats.filter((c) => c.pinned);
  const recents = chats.filter((c) => !c.pinned && !c.projectId);
  const item = (c: ChatDto) => <ChatItem key={c.id} chat={c} active={pathname === `/chat/${c.id}`} onPrompt={setPrompt} />;

  return (
    <>
      <SidebarNavItem href="/chat" icon="nav-plus" label={m.newChat} active={pathname === "/chat"} />
      <SidebarNavItem icon="nav-search" label={m.search} onClick={() => setSearchOpen(true)} />
      <div className="relative">
        <SidebarNavItem icon="nav-projects" label={m.projects} onClick={() => setProjectsOpen((v) => !v)} />
        <button
          type="button"
          aria-label={m.projectMenu.add}
          onClick={() => setPrompt({ kind: "newProject" })}
          className="absolute top-1/2 right-2 flex size-[26px] -translate-y-1/2 items-center justify-center rounded-[13px] text-icon transition-colors hover:bg-accent"
        >
          <Icon name="plus-sm" size={17} />
        </button>
      </div>
      {projectsOpen && (
        <div className="flex flex-col gap-[2px] pl-3">
          {projects.length === 0 ? (
            <p className="px-[10px] py-1.5 text-[12.5px] text-subtle">{m.projectMenu.none}</p>
          ) : (
            projects.map((p) => (
              <ProjectItem key={p.id} project={p} chats={chats.filter((c) => c.projectId === p.id)} onPrompt={setPrompt}>
                {item}
              </ProjectItem>
            ))
          )}
        </div>
      )}
      <SidebarNavItem href="/learn" icon="nav-cap" label={m.learningPaths} active={pathname.startsWith("/learn")} />

      {pinned.length > 0 && <SidebarSection title={m.pinned}>{pinned.map(item)}</SidebarSection>}
      <SidebarSection title={m.recents}>
        {loading
          ? [72, 56, 64, 48].map((w) => (
              <div key={w} className="flex h-[34px] items-center px-[10px]" aria-hidden>
                <span className="h-3 animate-pulse rounded-full bg-foreground/8" style={{ width: `${w}%` }} />
              </div>
            ))
          : recents.map(item)}
      </SidebarSection>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <PromptDialog prompt={prompt} onClose={() => setPrompt(null)} />
    </>
  );
}

function ChatItem({ chat, active, onPrompt }: { chat: ChatDto; active: boolean; onPrompt: (p: Prompt) => void }) {
  const m = useMessages().app.sidebar.chatMenu;
  const { updateChat, projects } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group/item relative">
      <SidebarHistoryItem href={`/chat/${chat.id}`} label={chat.title} active={active} />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={m.more}
          className={cn(
            "absolute top-1/2 right-1 flex size-[26px] -translate-y-1/2 items-center justify-center rounded-[8px] text-icon transition-colors hover:bg-accent",
            menuOpen ? "flex" : "hidden group-hover/item:flex group-focus-within/item:flex",
          )}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-48">
          <DropdownMenuItem onClick={() => void updateChat(chat.id, { pinned: !chat.pinned }).catch(() => undefined)}>
            {chat.pinned ? <PinOff /> : <Pin />} {chat.pinned ? m.unpin : m.pin}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPrompt({ kind: "renameChat", chat })}>
            <Pencil /> {m.rename}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Folder /> {m.moveTo}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-44">
              {projects
                .filter((p) => p.id !== chat.projectId)
                .map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => void updateChat(chat.id, { projectId: p.id }).catch(() => undefined)}
                  >
                    <Folder /> <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
              <DropdownMenuItem onClick={() => onPrompt({ kind: "newProject", moveChat: chat })}>
                <FolderPlus /> {m.newProject}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {chat.projectId && (
            <DropdownMenuItem onClick={() => void updateChat(chat.id, { removeFromProject: true }).catch(() => undefined)}>
              <FolderMinus /> {m.removeFromProject}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onPrompt({ kind: "deleteChat", chat })}>
            <Trash2 /> {m.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ProjectItem({
  project,
  chats,
  onPrompt,
  children,
}: {
  project: ProjectDto;
  chats: ChatDto[];
  onPrompt: (p: Prompt) => void;
  children: (c: ChatDto) => ReactNode;
}) {
  const m = useMessages().app.sidebar;
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col gap-[2px]">
      <div className="group/proj relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-[34px] w-full items-center gap-2 rounded-[10px] pr-9 pl-[10px] text-left transition-colors hover:bg-accent/60"
        >
          <ChevronRight className={cn("size-3.5 shrink-0 text-subtle transition-transform", open && "rotate-90")} />
          <Folder className="size-4 shrink-0 text-foreground-tertiary" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground-secondary">{project.name}</span>
          <span className="text-[12px] text-subtle group-hover/proj:hidden">{project.chatCount}</span>
        </button>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label={m.chatMenu.more}
            className={cn(
              "absolute top-1/2 right-1 size-[26px] -translate-y-1/2 items-center justify-center rounded-[8px] text-icon transition-colors hover:bg-accent",
              menuOpen ? "flex" : "hidden group-hover/proj:flex group-focus-within/proj:flex",
            )}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-44">
            <DropdownMenuItem onClick={() => onPrompt({ kind: "renameProject", project })}>
              <Pencil /> {m.projectMenu.rename}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onPrompt({ kind: "deleteProject", project })}>
              <Trash2 /> {m.projectMenu.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="flex flex-col gap-[2px] pl-4">
          {chats.length === 0 ? (
            <p className="px-[10px] py-1.5 text-[12.5px] text-subtle">{m.projectMenu.empty}</p>
          ) : (
            chats.map(children)
          )}
        </div>
      )}
    </div>
  );
}

/** Title search over the Chat tab (GET /api/chats?tab=CHAT&q=). */
function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const m = useMessages().app.sidebar.searchDialog;
  const { chats } = useSession();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ChatDto[] | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!open || !term) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api
        .get<PageResponse<ChatDto>>(`/api/chats?tab=CHAT&size=20&q=${encodeURIComponent(term)}`, ctrl.signal)
        .then((p) => setFound(p.items))
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const searching = q.trim().length > 0;
  const list = searching ? (found ?? []) : chats.slice(0, 8);
  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setQ("");
      setFound(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) setFound(null);
            }}
            placeholder={m.placeholder}
            className="pl-9"
          />
        </div>
        {!searching && chats.length > 0 && <p className="text-[12.5px] font-medium text-subtle">{m.recent}</p>}
        <ul className="-mx-1 flex max-h-[50vh] flex-col overflow-y-auto">
          {searching && found !== null && list.length === 0 && (
            <li className="px-3 py-4 text-center text-[13.5px] text-muted-foreground">{m.empty}</li>
          )}
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                onClick={() => close(false)}
                className="flex flex-col rounded-xl px-3 py-2 transition-colors hover:bg-accent/60"
              >
                <span className="truncate text-[14px] text-foreground">{c.title}</span>
                {c.lastMessagePreview && (
                  <span className="truncate text-[12.5px] text-muted-foreground">{c.lastMessagePreview}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Rename / create (one text field) and delete confirmations for chats and projects. */
function PromptDialog({ prompt, onClose }: { prompt: Prompt | null; onClose: () => void }) {
  const s = useMessages().app.sidebar;
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [shown, setShown] = useState<Prompt | null>(null);

  // Reset the form whenever a new prompt opens (state derived from props during render, no effect needed).
  if (prompt && prompt !== shown) {
    setShown(prompt);
    setName(prompt.kind === "renameChat" ? prompt.chat.title : prompt.kind === "renameProject" ? prompt.project.name : "");
    setFailed(false);
    setBusy(false);
  }

  const p = prompt ?? shown;
  const isDelete = p?.kind === "deleteChat" || p?.kind === "deleteProject";
  const title = !p
    ? ""
    : p.kind === "renameChat"
      ? s.chatMenu.renameTitle
      : p.kind === "deleteChat"
        ? s.chatMenu.deleteTitle
        : p.kind === "newProject"
          ? s.projectMenu.createTitle
          : p.kind === "renameProject"
            ? s.projectMenu.renameTitle
            : s.projectMenu.deleteTitle;
  const hint =
    p?.kind === "deleteChat"
      ? s.chatMenu.deleteBody
      : p?.kind === "deleteProject"
        ? s.projectMenu.deleteBody
        : p?.kind === "newProject"
          ? s.projectMenu.createHint
          : null;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!p || busy) return;
    const value = name.trim();
    if (!isDelete && !value) return;
    setBusy(true);
    setFailed(false);
    try {
      switch (p.kind) {
        case "renameChat":
          await session.updateChat(p.chat.id, { title: value });
          break;
        case "deleteChat":
          await session.deleteChat(p.chat.id);
          if (pathname === `/chat/${p.chat.id}`) router.push("/chat");
          break;
        case "newProject": {
          const created = await session.createProject(value);
          if (p.moveChat) await session.updateChat(p.moveChat.id, { projectId: created.id });
          break;
        }
        case "renameProject":
          await session.renameProject(p.project.id, value);
          break;
        case "deleteProject":
          await session.deleteProject(p.project.id);
          break;
      }
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Dialog open={prompt !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {hint && <DialogDescription>{hint}</DialogDescription>}
          </DialogHeader>
          {!isDelete && (
            <Input
              autoFocus
              value={name}
              maxLength={p?.kind === "renameChat" ? 120 : 60}
              placeholder={s.projectMenu.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          {failed && <p className="text-[13px] text-destructive">{s.chatMenu.failed}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {s.chatMenu.cancel}
            </Button>
            <Button type="submit" variant={isDelete ? "destructive" : "default"} disabled={busy || (!isDelete && !name.trim())}>
              {isDelete ? s.chatMenu.delete : p?.kind === "newProject" ? s.projectMenu.create : s.chatMenu.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
