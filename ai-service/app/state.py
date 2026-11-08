"""Process-wide state: the active rules snapshot (swapped atomically on reload)."""

from __future__ import annotations

from app.rules.models import Rules

_rules: Rules | None = None


def rules() -> Rules:
    if _rules is None:
        raise RuntimeError("rules not loaded")
    return _rules


def set_rules(new: Rules) -> None:
    global _rules
    _rules = new
