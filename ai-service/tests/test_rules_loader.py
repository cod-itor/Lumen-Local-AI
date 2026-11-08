import shutil
from pathlib import Path

import pytest

from app.harness.budget import est_tokens
from app.harness.profiles import resolve_profile
from app.rules.loader import RulesInvalid, load_rules
from app.rules.render import RulesRenderError, render
from tests.conftest import RULES_DIR


def test_real_rules_load(rules):
    assert set(rules.modes) >= {"chat", "rag", "web", "title", "quiz", "learning_plan"}
    assert rules.mode_for("MESSAGE", "RAG").abstain_text
    suite = rules.suites["core"]
    assert len(suite.cases) == 48 and suite.quick_count == 22
    assert rules.version.startswith("rules-")


def test_render_is_strict():
    assert render("Hi {{APP_NAME}}", {"APP_NAME": "Lumen"}) == "Hi Lumen"
    with pytest.raises(RulesRenderError):
        render("Hi {{MISSING}}", {})


def test_token_estimate_counts_khmer_heavier(rules):
    assert est_tokens("hello world", rules.harness) < est_tokens("សួស្តីពិភពលោក", rules.harness)


def test_profile_resolution(rules):
    p = resolve_profile(rules.models, "BROWSER", "Llama-3.2-1B-Instruct-q4f16_1-MLC")
    assert p["family"] == "llama3.2" and p["contextWindow"] == 4096
    host = resolve_profile(rules.models, "HOST", "llama3.2")
    assert host["contextWindow"] == 8192 and host["maxOutputTokens"] <= 2048
    q = resolve_profile(rules.models, "LOCAL_OLLAMA", "qwen3.5:2b", {"khmerNative": True})
    assert q["thinking"] == "FIELD" and q["khmerNative"] is True


def _copy_rules(tmp_path: Path) -> Path:
    dst = tmp_path / "rules"
    shutil.copytree(RULES_DIR, dst)
    return dst


def test_bad_heading_and_unknown_variable_are_rejected(tmp_path):
    d = _copy_rules(tmp_path)
    chat = d / "modes" / "chat.md"
    chat.write_text(chat.read_text().replace("## Reminder", "## Notes\n{{NOPE}}\n## Reminder"))
    with pytest.raises(RulesInvalid) as e:
        load_rules(d)
    text = " ".join(e.value.errors)
    assert "unexpected heading '## Notes'" in text and "NOPE" in text


def test_bad_regex_is_rejected(tmp_path):
    d = _copy_rules(tmp_path)
    h = d / "harness.yaml"
    h.write_text(h.read_text().replace("GREETING:\n", "GREETING:\n      - '(unclosed'\n"))
    with pytest.raises(RulesInvalid) as e:
        load_rules(d)
    assert any("does not compile" in err for err in e.value.errors)
