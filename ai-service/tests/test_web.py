"""Web search helpers (HARNESS.md §7.4) and the fetching URL guard (GUARDRAILS.md §9)."""

import pytest

from app.guard.url_safety import UrlBlocked, safe_get
from app.web.evidence import _allowed, build_query, site_of


def test_build_query_strips_filler_and_question_mark(rules):
    assert build_query("Can you please tell me the capital of Cambodia?", None, rules) == "the capital of Cambodia"


def test_build_query_follow_up_uses_previous_message(rules):
    q = build_query("what about its population?", "Phnom Penh history", rules)
    assert q.startswith("Phnom Penh history") and q.endswith("population")


def test_build_query_limits(rules):
    q = build_query(" ".join(f"w{i}" for i in range(40)), None, rules)
    assert len(q.split()) == rules.harness["web"]["queryMaxWords"]


def test_site_of():
    assert site_of("https://www.Example.com/a") == "example.com"


@pytest.mark.parametrize(
    ("url", "ok"),
    [
        ("https://en.wikipedia.org/wiki/Angkor_Wat", True),
        ("http://127.0.0.1/admin", False),
        ("https://example.com/setup.exe", False),
        ("ftp://example.com/file", False),
        ("https://printer.local/", False),
    ],
)
def test_allowed(rules, url, ok):
    assert _allowed(url, rules) is ok


async def test_safe_get_refuses_private_hosts():
    with pytest.raises(UrlBlocked):
        await safe_get("http://127.0.0.1:8001/health")
    with pytest.raises(UrlBlocked):
        await safe_get("http://169.254.169.254/latest/meta-data/")
