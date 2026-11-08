import type { MessageDto } from "@/types/api";

/** Message tree helpers (API_CONTRACT §4.4 branching rule). */

/** The visible conversation: root → activeLeafId. */
export function activePath(messages: MessageDto[], leafId: string | null): MessageDto[] {
  if (!leafId) return [];
  const byId = new Map(messages.map((m) => [m.id, m]));
  const path: MessageDto[] = [];
  for (let m = byId.get(leafId); m && path.length < 2000; m = m.parentId ? byId.get(m.parentId) : undefined) {
    path.push(m);
  }
  return path.reverse();
}

/** Messages with the same parent and role, oldest first (shown as versions "< 2 / 3 >"). */
export function siblingsOf(messages: MessageDto[], m: MessageDto): MessageDto[] {
  return messages
    .filter((x) => x.parentId === m.parentId && x.role === m.role)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Deepest leaf under a message, always following the newest child. */
export function deepestLeaf(messages: MessageDto[], startId: string): string {
  let id = startId;
  for (let guard = 0; guard < 2000; guard++) {
    const children = messages.filter((x) => x.parentId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!children.length) return id;
    id = children[0].id;
  }
  return id;
}
