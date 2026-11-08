"""URL safety validator against SSRF (GUARDRAILS.md §9). Used before every request to a URL that came from outside."""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass, field
from urllib.parse import urlsplit

_BLOCKED_NETS = [
    ipaddress.ip_network(n)
    for n in (
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.168.0.0/16",
        "198.18.0.0/15",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::1/128",
        "::/128",
        "fc00::/7",
        "fe80::/10",
        "::ffff:0:0/96",
    )
]
_BAD_SUFFIX = (".local", ".internal", ".localhost")


@dataclass
class UrlCheck:
    ok: bool
    reason: str | None = None
    host: str | None = None
    port: int | None = None
    addresses: list[str] = field(default_factory=list)


def is_public(addr: str) -> bool:
    ip = ipaddress.ip_address(addr)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return is_public(str(ip.ipv4_mapped))
    return not any(ip in net for net in _BLOCKED_NETS if net.version == ip.version)


def _literal_ip(host: str) -> str | None:
    """IPv4/IPv6 literals, including decimal/octal/hex spellings that resolvers accept (e.g. 2130706433)."""
    try:
        return str(ipaddress.ip_address(host.strip("[]")))
    except ValueError:
        pass
    try:  # inet_aton accepts 127.1, 0x7f.1, 017700000001, 2130706433
        return socket.inet_ntoa(socket.inet_aton(host))
    except OSError:
        return None


def check_static(url: str, purpose: str) -> UrlCheck:
    """Steps 1–2 (no DNS)."""
    try:
        p = urlsplit(url.strip())
        port = p.port
    except ValueError:
        return UrlCheck(False, "INVALID_URL")
    scheme = p.scheme.lower()
    if purpose == "REMOTE_URL":
        if scheme != "https":
            return UrlCheck(False, "SCHEME_NOT_ALLOWED")
    elif scheme not in ("http", "https"):
        return UrlCheck(False, "SCHEME_NOT_ALLOWED")
    if p.username or p.password or "@" in p.netloc:
        return UrlCheck(False, "USERINFO_NOT_ALLOWED")
    host = (p.hostname or "").rstrip(".").lower()
    if not host:
        return UrlCheck(False, "EMPTY_HOST")
    default = 443 if scheme == "https" else 80
    if purpose == "REMOTE_URL":
        if port is not None and port < 1024 and port != 443:
            return UrlCheck(False, "PORT_NOT_ALLOWED")
    elif port not in (None, 80, 443):
        return UrlCheck(False, "PORT_NOT_ALLOWED")
    literal = _literal_ip(host)
    if literal is None:
        if host == "localhost" or host.endswith(_BAD_SUFFIX) or "." not in host:
            return UrlCheck(False, "HOST_NOT_ALLOWED")
    elif not is_public(literal):
        return UrlCheck(False, "PRIVATE_ADDRESS")
    return UrlCheck(True, None, host, port or default, [literal] if literal else [])


async def check_url(url: str, purpose: str = "WEB") -> UrlCheck:
    """Steps 1–3: every resolved A/AAAA address must be public. The caller pins `addresses[0]` for the request."""
    res = check_static(url, purpose)
    if not res.ok or res.addresses:
        return res
    assert res.host is not None  # noqa: S101 — set when ok
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(res.host, res.port, type=socket.SOCK_STREAM)
    except OSError:
        return UrlCheck(False, "DNS_FAILED", res.host, res.port)
    addrs = list(dict.fromkeys(str(i[4][0]) for i in infos))
    if not addrs:
        return UrlCheck(False, "DNS_FAILED", res.host, res.port)
    if not all(is_public(a) for a in addrs):
        return UrlCheck(False, "PRIVATE_ADDRESS", res.host, res.port, addrs)
    return UrlCheck(True, None, res.host, res.port, addrs)
