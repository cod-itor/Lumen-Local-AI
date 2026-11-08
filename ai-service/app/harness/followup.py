"""Follow-up messages and per-turn answer language (rules/harness.yaml → router). Pure code, never calls a model."""

from __future__ import annotations

from typing import Any

from app.rules.models import Rules


def is_follow_up(text: str, r: Rules) -> bool:
    return any(p.search(text.strip()) for p in r.patterns.get("router.followUpPatterns", []))


def topic(history: list[dict[str, Any]], previous: str | None, r: Rules) -> str | None:
    """The last earlier user message that is a real question (not itself a follow-up), newest first."""
    users = [str(m.get("content") or "") for m in history if str(m.get("role") or "").lower() == "user"]
    if previous and (not users or users[-1].strip() != previous.strip()):
        users.append(previous)
    for text in reversed(users):
        if text.strip() and not is_follow_up(text, r):
            return text.strip()
    return None


def turn_output_language(
    original: str, input_language: str, setting: str, r: Rules, follow_up_of: str | None = None
) -> str:
    """Language asked for in the message wins; then Khmer input (or a follow-up of a Khmer question, or of a
    question that asked for Khmer) → Khmer; else the setting."""
    if any(p.search(original) for p in r.patterns.get("router.answerInEnglishPatterns", [])):
        return "EN"
    if any(p.search(original) for p in r.patterns.get("router.answerInKhmerPatterns", [])):
        return "KM"
    if (
        follow_up_of is not None
        and setting == "EN"
        and (
            any(p.search(follow_up_of) for p in r.patterns.get("router.answerInKhmerPatterns", []))
            or any("\u1780" <= c <= "\u17ff" for c in follow_up_of)
        )
    ):
        return "KM"
    if input_language == "KM" and (r.harness.get("router") or {}).get("khmerInputAnswersInKhmer"):
        return "KM" if setting != "BOTH" else "BOTH"
    return setting


def strip_language_request(text: str, r: Rules) -> str:
    """'What is an animal, answer in Khmer' → 'What is an animal' (rules/harness.yaml → router.languageRequestStrip)."""
    for p in r.patterns.get("router.languageRequestStrip", []):
        text = p.sub("", text)
    return text.strip(" ,.;:-")
