"""Generation parameters (HARNESS.md §7.6) and client guard config (§8.1)."""

from __future__ import annotations

from typing import Any

from app.rules.models import Mode


def max_tokens(task: str, mode: Mode, profile: dict[str, Any], answer_length: str, harness: dict[str, Any]) -> int:
    value = mode.max_output_tokens
    if task == "MESSAGE":
        rule = harness["answerLength"].get(answer_length) or harness["answerLength"]["NORMAL"]
        value = round(value * rule["wordsFactor"]) if rule["wordsFactor"] > 1 else value
        if rule["maxTokensCap"] is not None:
            value = min(value, rule["maxTokensCap"])
    return max(16, min(value, int(profile["maxOutputTokens"])))


def max_words(task: str, mode: Mode, answer_length: str, harness: dict[str, Any]) -> int:
    if task != "MESSAGE":
        return mode.max_words
    rule = harness["answerLength"].get(answer_length) or harness["answerLength"]["NORMAL"]
    return max(20, round(mode.max_words * rule["wordsFactor"]))


def build_params(
    *,
    task: str,
    mode: Mode,
    pipeline: str | None,
    profile: dict[str, Any],
    kind: str,
    user: dict[str, Any],
    harness: dict[str, Any],
    greeting: bool,
    eval_case: bool = False,
) -> dict[str, Any]:
    gen = harness["generation"]
    caps = harness["temperatureCaps"]
    guard_profile = user.get("guardProfile") or "STANDARD"
    temperature = mode.temperature
    if pipeline == "CHAT" and user.get("temperature") is not None and guard_profile != "TEST":
        temperature = float(user["temperature"])
    if guard_profile != "TEST":
        if pipeline in ("RAG", "WEB"):
            temperature = min(temperature, caps["grounded"])
        if mode.output == "json":
            temperature = min(temperature, caps["json"])
        if guard_profile == "STRICT":
            temperature = min(temperature, caps["strictProfile"])
    out_tokens = max_tokens(task, mode, profile, user.get("answerLength") or "NORMAL", harness)
    if greeting:
        out_tokens = min(out_tokens, harness["router"]["greetingMaxTokens"])
    stop = [] if mode.output == "json" else list(mode.stop) + list(gen["standardStops"])
    return {
        "temperature": round(float(temperature), 3),
        "topP": float(profile.get("topP", 0.9)),
        "maxTokens": out_tokens,
        "stop": stop,
        "repeatPenalty": float(
            gen["repeatPenaltyGrounded"] if pipeline in ("RAG", "WEB") else profile.get("repeatPenalty", 1.1)
        ),
        "minP": float(gen["minP"]) if kind in ("HOST", "LOCAL_OLLAMA") else None,
        "seed": gen["evalSeed"] if eval_case else None,
        "numCtx": int(profile["contextWindow"]),
    }


def client_guard(params: dict[str, Any], harness: dict[str, Any], guardrails: dict[str, Any]) -> dict[str, Any]:
    return {
        "stopPatterns": list(guardrails.get("clientStopPatterns") or []),
        "maxOutputChars": int(params["maxTokens"] * harness["generation"]["maxOutputCharsPerToken"]),
        "loop": dict(harness["loopDetection"]),
    }
