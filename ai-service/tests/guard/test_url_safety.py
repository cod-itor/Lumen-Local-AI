"""SSRF validator (GUARDRAILS.md §9, §12.4)."""

from __future__ import annotations

import socket

import pytest

from app.guard import url_safety
from app.guard.url_safety import check_static, check_url, is_public


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://10.1.2.3/",
        "http://172.16.0.1/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://100.64.0.1/",
        "http://0.0.0.0/",
        "http://[::1]/",
        "http://[fe80::1]/",
        "http://[fc00::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://2130706433/",
        "http://0x7f000001/",
        "http://017700000001/",
        "http://127.1/",
        "http://localhost/",
        "http://printer.local/",
        "http://db.internal/",
        "http://intranet/",
        "http://user:pass@example.com/",
        "ftp://example.com/",
        "http://example.com:8080/",
    ],
)
def test_rejected_static(url):
    assert not check_static(url, "WEB").ok


def test_public_ok():
    assert check_static("https://example.com/a", "WEB").ok
    assert check_static("https://8.8.8.8/", "WEB").ok


def test_remote_url_rules():
    assert not check_static("http://api.example.com/v1", "REMOTE_URL").ok
    assert check_static("https://api.example.com:8443/v1", "REMOTE_URL").ok
    assert not check_static("https://api.example.com:22/v1", "REMOTE_URL").ok


def test_is_public():
    assert is_public("1.1.1.1") and not is_public("::ffff:10.0.0.1") and is_public("2606:4700:4700::1111")


async def test_dns_to_private_rejected(monkeypatch):
    class Loop:
        async def getaddrinfo(self, host, port, type=0):  # noqa: A002
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", port))]

    monkeypatch.setattr(url_safety.asyncio, "get_running_loop", lambda: Loop())
    res = await check_url("https://rebind.example.com/", "WEB")
    assert not res.ok and res.reason == "PRIVATE_ADDRESS"


async def test_dns_public_ok(monkeypatch):
    class Loop:
        async def getaddrinfo(self, host, port, type=0):  # noqa: A002
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]

    monkeypatch.setattr(url_safety.asyncio, "get_running_loop", lambda: Loop())
    res = await check_url("https://example.com/", "WEB")
    assert res.ok and res.addresses == ["93.184.216.34"]
