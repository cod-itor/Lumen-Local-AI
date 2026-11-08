"""Language detection and answer language (HARNESS.md §6.3)."""

from __future__ import annotations

from typing import Any

from app.harness.budget import is_khmer


def detect_language(text: str, harness: dict[str, Any]) -> str:
    cfg = harness["language"]
    letters = khmer = latin = 0
    for ch in text:
        if is_khmer(ch):
            khmer += 1
            letters += 1
        elif ch.isalpha():
            letters += 1
            if ch.isascii():
                latin += 1
    if letters < cfg["minLettersForDetection"]:
        return "EN"
    if khmer / letters >= cfg["kmThreshold"]:
        return "KM"
    if khmer / letters >= cfg["mixedThreshold"]:
        return "MIXED"
    if latin / letters >= 0.5:
        return "EN"
    return "OTHER"


def khmer_ratio(text: str) -> float:
    letters = [ch for ch in text if ch.isalpha() or is_khmer(ch)]
    if not letters:
        return 0.0
    return sum(1 for ch in letters if is_khmer(ch)) / len(letters)


def answer_language(task: str, output_language: str, profile: dict[str, Any]) -> str:
    if task == "MESSAGE" and output_language == "KM" and profile.get("khmerNative"):
        return "Khmer"
    return "English"
