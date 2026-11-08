"""Model profile resolution (HARNESS.md §2.2) from rules/models.yaml."""

from __future__ import annotations

import re
from typing import Any

PROFILE_KEYS = ("family", "contextWindow", "systemRole", "jsonSchema", "thinking", "disableThinking", "khmerNative",
                "maxOutputTokens", "topP", "repeatPenalty", "tokenFactor")


def resolve_profile(models: dict[str, Any], kind: str, model: str, overrides: dict[str, Any] | None = None
                    ) -> dict[str, Any]:
    profile: dict[str, Any] = {k: v for k, v in models["defaults"].items() if k in PROFILE_KEYS}
    for family in models.get("families") or []:
        if any(re.search(p, model, re.IGNORECASE) for p in family.get("match") or []):
            profile.update({k: v for k, v in family.items() if k in PROFILE_KEYS})
            per_kind = (family.get("kinds") or {}).get(kind) or {}
            profile.update({k: v for k, v in per_kind.items() if k in PROFILE_KEYS})
            break
    profile.update({k: v for k, v in (overrides or {}).items() if k in PROFILE_KEYS and k != "family"})
    profile["contextWindow"] = max(2048, min(32768, int(profile["contextWindow"])))
    profile["maxOutputTokens"] = min(int(profile["maxOutputTokens"]), profile["contextWindow"] // 4)
    return profile
