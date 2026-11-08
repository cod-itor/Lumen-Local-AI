"""Document parsing and cleaning (AI_SERVICE.md §13 steps 1–2). Pages are 1-based; non-PDF files are one page."""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from app.errors import ServiceError
from app.harness.normalize import normalize

MAX_PAGES = 300
_LIST_LINE = re.compile(r"^\s*(?:[-*+•]|\d+[.)]|#{1,6}\s)")
FRAGMENT_MIN_LINES = 20  # some PDF writers (e.g. Google Docs) place every word separately → one word per line
FRAGMENT_SHARE = 0.6


def _fragmented(text: str) -> bool:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return len(lines) >= FRAGMENT_MIN_LINES and sum(len(ln.split()) == 1 for ln in lines) >= FRAGMENT_SHARE * len(lines)


def _pdf_page_text(page: object) -> str:
    """pypdf's plain extraction; when it comes out one word per line, the layout mode (which rebuilds lines from the
    word positions) with its column padding collapsed."""
    text = page.extract_text() or ""  # type: ignore[attr-defined]
    if not _fragmented(text):
        return text
    layout = page.extract_text(extraction_mode="layout") or ""  # type: ignore[attr-defined]
    lines = [re.sub(r"[ \t]{2,}", " ", ln).strip() for ln in layout.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() or text


def parse(path: Path, mime: str) -> tuple[list[str], bool]:
    """Raw page texts and whether the file is paginated (PDF)."""
    try:
        if mime == "application/pdf" or path.suffix.lower() == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            if len(reader.pages) > MAX_PAGES:
                raise ServiceError("TOO_MANY_PAGES", f"This PDF has more than {MAX_PAGES} pages.", 422)
            pages = [_pdf_page_text(p) for p in reader.pages]
            if not pages:
                raise ServiceError("EMPTY_DOCUMENT", "This document has no text.", 422)
            if sum(1 for p in pages if len(p.strip()) < 30) >= 0.5 * len(pages):
                raise ServiceError("SCANNED_PDF", "This PDF has no selectable text; OCR is not supported.", 422)
            return pages, True
        if path.suffix.lower() == ".docx":
            import docx

            d = docx.Document(str(path))
            parts: list[str] = []
            for block in d.iter_inner_content():
                if hasattr(block, "rows"):
                    for row in block.rows:
                        parts.append(" | ".join(c.text.strip() for c in row.cells))
                    parts.append("")
                else:
                    parts.append(block.text)
                    parts.append("")
            return ["\n".join(parts)], False
        return [path.read_text("utf-8")], False
    except ServiceError:
        raise
    except Exception as e:  # noqa: BLE001
        raise ServiceError("PARSE_FAILED", "Could not read this file.", 422) from e


def _key(line: str) -> str:
    return re.sub(r"\d+", "#", line.strip().lower())


def clean(pages: list[str], guardrails: dict | None = None) -> list[str]:
    """Remove repeated headers/footers (≥ 4 pages), join hyphenated breaks and wrapped lines, normalize."""
    repeated: set[str] = set()
    if len(pages) >= 4:
        counts = Counter(k for p in pages for k in {_key(line) for line in p.split("\n") if line.strip()})
        repeated = {k for k, c in counts.items() if c >= 0.5 * len(pages)}
    out = []
    for p in pages:
        lines = [line for line in p.replace("\r\n", "\n").replace("\r", "\n").split("\n") if _key(line) not in repeated]
        text = re.sub(r"(\w)-\n(\w)", r"\1\2", "\n".join(lines))
        paras = re.split(r"\n\s*\n", text)
        joined = []
        for para in paras:
            buf = ""
            for line in para.split("\n"):
                if not line.strip():
                    continue
                if not buf:
                    buf = line.strip()
                elif _LIST_LINE.match(line):
                    buf += "\n" + line.strip()
                else:
                    buf += " " + line.strip()
            if buf:
                joined.append(buf)
        out.append(normalize("\n\n".join(joined), guardrails).strip())
    return out
