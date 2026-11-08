"""Guard decisions (GUARDRAILS.md §5): input check, output check, leak check, disclaimers, refusals, masking.

Pure code driven by rules/guardrails.yaml. Optional classifiers (Llama Guard via Ollama, Prompt Guard 2) run only when
both the guard profile asks for them and the owner turned them on in .env; otherwise regex rules decide.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.rules.models import Rules

FIRST_PERSON = re.compile(r"\b(i|i'm|i am|im|me|my|myself)\b|ខ្ញុំ", re.IGNORECASE | re.UNICODE)
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


@dataclass
class Decision:
    action: str = "ALLOW"  # effective action
    categories: list[str] = field(default_factory=list)
    rule: str | None = None
    would_action: str | None = None  # TEST profile: what would have happened
    injection_suspected: bool = False
    notes: list[str] = field(default_factory=list)  # SAFE_COMPLETE prompt notes
    disclaimers: list[str] = field(default_factory=list)  # SAFE_COMPLETE categories with a disclaimer
    events: list[dict[str, Any]] = field(default_factory=list)

    def summary(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "categories": self.categories,
            "injectionSuspected": self.injection_suspected,
            "wouldAction": self.would_action,
        }


def profile_cfg(r: Rules, profile: str) -> dict[str, Any]:
    profiles = r.guardrails["profiles"]
    return profiles.get(profile) or profiles["STANDARD"]


def category_action(r: Rules, category: str, profile: str) -> str:
    actions = r.guardrails["categories"][category]["action"]
    return actions.get(profile) or actions.get("STANDARD") or "ALLOW"


def rule_hits(r: Rules, texts: list[str], stage: str) -> list[tuple[str, str]]:
    """(category, rule id) for every regex rule of this stage that matches any of the texts."""
    out: list[tuple[str, str]] = []
    for rule in r.guardrails.get("rules") or []:
        if rule["stage"] not in (stage, "BOTH"):
            continue
        pats = r.patterns.get(f"guard.rule.{rule['id']}", [])
        excepts = r.patterns.get(f"guard.except.{rule['id']}", [])
        hit = any(p.search(t) and not any(e.search(t) for e in excepts) for p in pats for t in texts if t)
        if hit:
            out.append((rule["category"], rule["id"]))
    return out


def injection_score(r: Rules, text: str) -> tuple[float, str | None]:
    best, best_id = 0.0, None
    for item in (r.guardrails.get("injection") or {}).get("patterns") or []:
        pats = r.patterns.get(f"guard.injection.{item['id']}", [])
        if any(p.search(text) for p in pats) and float(item["weight"]) > best:
            best, best_id = float(item["weight"]), item["id"]
    return best, best_id


def mask(r: Rules, text: str) -> str:
    """Log excerpt: emails, phones and long numbers masked, then cut (GUARDRAILS.md §11)."""
    cfg = r.guardrails.get("logMasking") or {}
    for item in cfg.get("patterns") or []:
        for p in r.patterns.get(f"guard.mask.{item['name']}", []):
            text = p.sub(item["replace"], text)
    return " ".join(text.split())[: int(cfg.get("excerptMaxChars", 200))]


def event(r: Rules, stage: str, action: str, categories: list[str], rule: str | None, text: str, profile: str):
    return {
        "stage": stage,
        "action": action,
        "categories": categories,
        "rule": rule or "classifier",
        "excerpt": mask(r, text),
        "profile": profile,
    }


def _finish(r: Rules, d: Decision, stage: str, text: str, profile: str) -> Decision:
    """TEST records `wouldAction` and never acts; every non-ALLOW decision logs a guard event."""
    if d.action != "ALLOW":
        d.events.append(event(r, stage, d.action, d.categories, d.rule, text, profile))
    if profile_cfg(r, profile).get("recordOnly"):
        d.would_action = d.action
        d.action = "ALLOW"
        d.notes, d.disclaimers = [], []
        d.injection_suspected = False  # TEST measures the raw model inside the harness
    return d


async def check_input(r: Rules, text: str, model_text: str, profile: str, kind: str = "TEXT") -> Decision:
    """GUARDRAILS.md §5.1 (and §4.4 for kind IMAGE_PROMPT)."""
    cfg = profile_cfg(r, profile)
    d = Decision()
    texts = [text] if text == model_text else [text, model_text]
    if len(text) > int(cfg["maxInputChars"]):  # 1
        d.action, d.rule, d.categories = "BLOCK", "too_long", []
        return _finish(r, d, "INPUT", text, profile)

    hits = rule_hits(r, texts, "INPUT")  # 2
    inj, inj_id = injection_score(r, model_text)  # 3
    if inj_id is None and model_text != text:
        inj, inj_id = injection_score(r, text)
    inj_threshold = float(r.guardrails["classifiers"]["injection"]["threshold"])
    if cfg.get("injectionClassifier"):
        from app.guard import classifiers

        score = await classifiers.prompt_guard_score(model_text)
        if score is not None and score > inj:
            inj, inj_id = score, "classifier"
    clf: set[str] = set()
    if cfg.get("contentClassifierInput"):  # 4
        from app.guard import classifiers

        clf = await classifiers.llama_guard(r, model_text, None)

    if kind == "IMAGE_PROMPT":  # §4.4
        pol = r.guardrails.get("imagePolicy") or {}
        for i, item in enumerate(pol.get("blockPatterns") or []):
            if any(p.search(t) for p in r.patterns.get(f"guard.image.{i}", []) for t in texts):
                hits.append((item["category"], f"image_{item['category']}"))
        if profile == "STRICT":
            for src in pol.get("strictExtra") or []:
                if any(re.search(src, t, re.IGNORECASE | re.UNICODE) for t in texts):
                    hits.append(("graphic_horror", "image_strict_extra"))
                    break

    by_cat: dict[str, str] = {}
    for cat, rid in hits:
        by_cat.setdefault(cat, rid)
    cats = list(dict.fromkeys([c for c, _ in hits] + sorted(clf)))  # 5
    catdefs = r.guardrails["categories"]
    first_person = bool(FIRST_PERSON.search(text) or FIRST_PERSON.search(model_text))
    critical = [c for c in cats if catdefs[c]["severity"] == "critical" and c != "self_harm"]
    blocking = [c for c in cats if category_action(r, c, profile) == "BLOCK"]
    safe = [c for c in cats if category_action(r, c, profile) == "SAFE_COMPLETE"]

    if critical:  # 6a
        d.action, d.categories = "BLOCK", critical
    elif ("self_harm" in by_cat and by_cat["self_harm"] == "self_harm_first_person") or (
        "self_harm" in clf and first_person
    ):  # 6b
        d.action, d.categories = "SUPPORT", ["self_harm"]
    elif "self_harm" in cats:  # educational self-harm question via the classifier only
        d.action, d.categories = "SAFE_COMPLETE", ["self_harm"]
    elif blocking:  # 6c
        d.action, d.categories = "BLOCK", blocking
    elif inj >= inj_threshold or (inj_id not in (None, "classifier") and inj >= 0.85):  # 6d
        d.action, d.categories, d.rule = cfg["injectionAction"], [], inj_id
        d.injection_suspected = True
    elif safe:  # 6e
        d.action, d.categories = "SAFE_COMPLETE", safe[:2]
    if d.action != "ALLOW" and d.rule is None:
        d.rule = next((by_cat[c] for c in d.categories if c in by_cat), "classifier")
    if d.action == "FLAG":
        d.injection_suspected = True
    if d.action == "SAFE_COMPLETE":
        notes = r.guardrails.get("notes") or {}
        for c in d.categories:
            note_key = catdefs[c].get("note")
            if note_key and note_key in notes:
                d.notes.append(notes[note_key])
            if catdefs[c].get("disclaimer"):
                d.disclaimers.append(catdefs[c]["disclaimer"])
    return _finish(r, d, "INPUT", text, profile)


def _shingles(text: str, n: int) -> set[str]:
    words = _PUNCT.sub(" ", text.lower()).split()
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def leaked(r: Rules, content: str, instructions_text: str, user_text: str, abstain_text: str | None) -> bool:
    """GUARDRAILS.md §5.4: ≥ minLeakedShingles 8-word sequences of the system prompt + mode Instructions."""
    cfg = (r.guardrails.get("output") or {}).get("leak") or {}
    n = int(cfg.get("shingleWords", 8))
    secret = _shingles(instructions_text, n)
    allowed = _shingles(user_text, n) | _shingles(abstain_text or "", n)
    for group in ("refusals", "abstain"):
        for pair in (r.guardrails.get(group) or {}).values():
            for v in pair.values():
                allowed |= _shingles(str(v), n)
    for v in (r.guardrails.get("disclaimers") or {}).values():
        allowed |= _shingles(str(v.get("EN", "")), n)
    secret -= allowed
    found = secret & _shingles(content, n)
    return len(found) >= int(cfg.get("minLeakedShingles", 2))


async def check_output(
    r: Rules,
    content: str,
    *,
    english: str | None,
    question: str,
    profile: str,
    instructions_text: str,
    user_text: str,
    abstain_text: str | None,
) -> Decision:
    """GUARDRAILS.md §5.3. Returns ALLOW (with disclaimer categories), REPLACE or SUPPORT."""
    cfg = profile_cfg(r, profile)
    d = Decision()
    texts = [content] + ([english] if english and english != content else [])
    hits = rule_hits(r, texts, "OUTPUT")
    clf: set[str] = set()
    if cfg.get("contentClassifierOutput"):
        from app.guard import classifiers

        clf = await classifiers.llama_guard(r, question, english or content)
    by_cat: dict[str, str] = {}
    for cat, rid in hits:
        by_cat.setdefault(cat, rid)
    cats = list(dict.fromkeys([c for c, _ in hits] + sorted(clf)))
    catdefs = r.guardrails["categories"]
    if "self_harm" in cats:  # a
        d.action, d.categories = "SUPPORT", ["self_harm"]
    else:
        bad = [c for c in cats if catdefs[c]["severity"] == "critical" or category_action(r, c, profile) == "BLOCK"]
        if bad:  # b
            d.action, d.categories = "REPLACE", bad
        else:  # c/d
            d.disclaimers = [catdefs[c]["disclaimer"] for c in cats if catdefs[c].get("disclaimer")]
    if d.action != "ALLOW":
        d.rule = next((by_cat[c] for c in d.categories if c in by_cat), "classifier")
    elif leaked(r, english or content, instructions_text, user_text, abstain_text):  # 5
        d.action, d.categories, d.rule = "REPLACE", [], "system_prompt_leak"
    return _finish(r, d, "OUTPUT", english or content, profile)


def refusal_key(r: Rules, action: str, categories: list[str], rule: str | None) -> str:
    if action == "SUPPORT":
        return "self_harm_support"
    if rule == "system_prompt_leak" or (not categories and rule != "too_long"):
        return "injection"
    for c in categories:
        key = r.guardrails["categories"][c].get("refusal")
        if key:
            return key
    return "default"


def texts(r: Rules, key: str, group: str = "refusals") -> dict[str, str]:
    pair = dict(r.guardrails[group][key])
    line = (r.guardrails.get("support") or {}).get("emergencyLine") or {}
    for lang in ("EN", "KM"):
        pair[lang] = str(pair[lang]).replace("{{EMERGENCY_LINE}}", line.get(lang) or "")
    return pair


def localized(pair: dict[str, str], task: str, output_language: str) -> dict[str, Any]:
    """content/originalContent/translations of a prepared EN/KM text (AI_SERVICE.md §4.2)."""
    if task != "MESSAGE":
        return {
            "content": pair["KM"] if output_language == "KM" else pair["EN"],
            "originalContent": None,
            "translations": {},
        }
    if output_language == "KM":
        return {"content": pair["KM"], "originalContent": pair["EN"], "translations": {}}
    if output_language == "BOTH":
        return {"content": pair["EN"], "originalContent": None, "translations": {"KM": pair["KM"]}}
    return {"content": pair["EN"], "originalContent": None, "translations": {}}


def ensure_disclaimers(r: Rules, text: str, keys: list[str], lang: str) -> str:
    """GUARDRAILS.md §5.5: append the disclaimer when the answer has none of the `detect` phrases."""
    low = text.lower()
    for key in dict.fromkeys(keys):
        disc = (r.guardrails.get("disclaimers") or {}).get(key)
        if not disc or any(p.lower() in low for p in disc.get("detect") or []):
            continue
        text = f"{text.rstrip()}\n\n{disc['KM' if lang == 'KM' else 'EN']}"
    return text


def redact_instructions(r: Rules, text: str) -> str:
    """Replace each paragraph of an untrusted chunk that scores as an injection by the redaction marker."""
    threshold = float(r.guardrails["classifiers"]["injection"]["threshold"])
    marker = str(((r.guardrails.get("injection") or {}).get("untrustedText") or {}).get("redactMarker") or "")
    if not marker:
        return text
    parts = re.split(r"(\n\s*\n)", text)
    return "".join(marker if i % 2 == 0 and untrusted_score(r, p) >= threshold else p for i, p in enumerate(parts))


def untrusted_score(r: Rules, text: str) -> float:
    """§5.2 step 2 for document/web chunks (regex patterns; the classifier is optional)."""
    return injection_score(r, text)[0]
