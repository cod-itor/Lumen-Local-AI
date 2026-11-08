"""Deterministic output policy (GUARDRAILS.md §7.1): images, HTML, link allowlist, length. Code spans stay untouched."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlsplit, urlunsplit

_FENCE = re.compile(r"(```.*?(?:```|\Z)|`[^`\n]+`)", re.DOTALL)
_MD_IMAGE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_IMG_TAG = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
_HTML_TAG = re.compile(r"</?[A-Za-z][A-Za-z0-9-]*(\s[^<>]*)?/?>")
_MD_LINK = re.compile(r"(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
_BARE = re.compile(r"(?:https?://|www\.)[^\s<>()\[\]]+", re.IGNORECASE)
_TRAIL = ".,;:!?'\"”’)"


def norm_url(url: str) -> str:
    """lower-case scheme and host, drop default port, trailing `/` and fragment."""
    u = url.strip()
    if u.lower().startswith("www."):
        u = "http://" + u
    try:
        p = urlsplit(u)
    except ValueError:
        return u
    scheme = p.scheme.lower()
    host = (p.hostname or "").lower()
    default = (scheme == "http" and p.port == 80) or (scheme == "https" and p.port == 443)
    port = p.port if p.port and not default else None
    netloc = host + (f":{port}" if port else "")
    path = p.path.rstrip("/")
    return urlunsplit((scheme, netloc, path, p.query, ""))


def _split_code(text: str) -> list[tuple[bool, str]]:
    out: list[tuple[bool, str]] = []
    last = 0
    for m in _FENCE.finditer(text):
        if m.start() > last:
            out.append((False, text[last : m.start()]))
        out.append((True, m.group(0)))
        last = m.end()
    if last < len(text):
        out.append((False, text[last:]))
    return out


def apply(text: str, source_urls: list[str], cfg: dict[str, Any]) -> tuple[str, int]:
    """Returns (text, removedUrls)."""
    allowed = {norm_url(u) for u in source_urls if u}
    removed_text = (cfg.get("links") or {}).get("removedText", "[link removed]")
    only_sources = (cfg.get("links") or {}).get("allowSourceUrlsOnly", True)
    removed = 0

    def ok(url: str) -> bool:
        return not only_sources or norm_url(url) in allowed

    def link(m: re.Match[str]) -> str:
        nonlocal removed
        if ok(m.group(2)):
            return m.group(0)
        removed += 1
        return m.group(1)

    def bare(m: re.Match[str]) -> str:
        nonlocal removed
        url = m.group(0)
        tail = ""
        while url and url[-1] in _TRAIL:
            tail, url = url[-1] + tail, url[:-1]
        if ok(url):
            return url + tail
        removed += 1
        return removed_text + tail

    parts: list[str] = []
    kept: list[str] = []  # Markdown links that stay; protected from the bare-URL pass

    def keep(m: re.Match[str]) -> str:
        out = link(m)
        if out == m.group(0):
            kept.append(out)
            return f"\x00{len(kept) - 1}\x00"
        return out

    for is_code, seg in _split_code(text):
        if is_code:
            parts.append(seg)
            continue
        if cfg.get("removeImages", True):
            seg = _IMG_TAG.sub("", _MD_IMAGE.sub("", seg))
        if cfg.get("stripHtml", True):
            seg = _HTML_TAG.sub("", seg)
        seg = _MD_LINK.sub(keep, seg)
        seg = _BARE.sub(bare, seg)
        seg = re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], seg)
        parts.append(seg)
    out = "".join(parts)
    # Lines emptied by image removal are dropped.
    out = re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", out)
    return cut(out, int(cfg.get("maxChars", 12000))), removed


def cut(text: str, max_chars: int) -> str:
    """Cut at a paragraph boundary at or before max_chars."""
    if len(text) <= max_chars:
        return text
    head = text[:max_chars]
    i = head.rfind("\n\n")
    return (head[:i] if i > max_chars // 2 else head).rstrip()
