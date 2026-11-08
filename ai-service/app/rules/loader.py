"""Load and validate rules/ (RULES.md §2, AI_SERVICE.md §5). Any failure → RulesInvalid with every error found."""

from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from app.harness.budget import est_tokens
from app.rules.models import (
    EVAL_CATEGORIES,
    GLOBAL_VARIABLES,
    OUTPUTS,
    PIPELINES,
    REFERENCE_DATA,
    TASKS,
    EvalCase,
    EvalSuite,
    Mode,
    Rules,
    SystemPrompt,
)
from app.rules.render import RulesRenderError, render, variables_in

REQUIRED_MODE_KEYS = (
    "id",
    "version",
    "task",
    "pipeline",
    "output",
    "schema",
    "temperature",
    "max_output_tokens",
    "max_words",
    "reference_data",
)
SECTIONS = ("## Instructions", "## Example", "## Reminder")
MAX_SYSTEM_TOKENS = 900
RE_FLAGS = re.IGNORECASE | re.UNICODE
#: JSON Schema keywords the runtimes can all enforce (RULES.md §5).
SCHEMA_KEYWORDS = {
    "type",
    "properties",
    "required",
    "items",
    "enum",
    "minItems",
    "maxItems",
    "additionalProperties",
    "$schema",
    "$id",
    "title",
    "description",
}


class RulesInvalid(Exception):
    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors


def _front_matter(text: str, where: str, errors: list[str]) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        errors.append(f"{where}: missing YAML front matter")
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        errors.append(f"{where}: front matter is not closed with ---")
        return {}, text
    try:
        meta = yaml.safe_load(text[4:end]) or {}
    except yaml.YAMLError as e:
        errors.append(f"{where}: front matter does not parse: {e}")
        return {}, text
    if not isinstance(meta, dict):
        errors.append(f"{where}: front matter must be a mapping")
        return {}, text
    return meta, text[end + 5 :]


def _split_sections(body: str, where: str, errors: list[str]) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in body.splitlines():
        stripped = line.rstrip()
        if stripped in SECTIONS:
            if stripped in sections:
                errors.append(f"{where}: section '{stripped}' appears twice")
            current = stripped
            sections[current] = []
        elif stripped.startswith("## "):
            errors.append(f"{where}: unexpected heading '{stripped}' (only {', '.join(SECTIONS)} are allowed)")
        elif current is not None:
            sections[current].append(line)
        elif stripped:
            errors.append(f"{where}: text before '## Instructions'")
    for required in ("## Instructions", "## Reminder"):
        if required not in sections:
            errors.append(f"{where}: missing '{required}'")
    return {k: "\n".join(v).strip() for k, v in sections.items()}


def _load_system(path: Path, errors: list[str]) -> SystemPrompt:
    meta, body = _front_matter(path.read_text("utf-8"), "system_prompt.md", errors)
    variables = tuple(meta.get("variables") or ())
    unknown = variables_in(body) - GLOBAL_VARIABLES - set(variables)
    if unknown:
        errors.append(f"system_prompt.md: unknown variables {sorted(unknown)}")
    return SystemPrompt(version=int(meta.get("version", 0)), variables=variables, body=body.strip())


def _check_schema_subset(node: Any, where: str, errors: list[str]) -> None:
    if isinstance(node, dict):
        for k, v in node.items():
            if k not in SCHEMA_KEYWORDS:
                errors.append(f"{where}: keyword '{k}' is outside the supported subset (RULES.md §5)")
            if k == "properties" and isinstance(v, dict):
                for prop, sub in v.items():
                    _check_schema_subset(sub, f"{where}.{prop}", errors)
            elif k == "items":
                _check_schema_subset(v, f"{where}[]", errors)


def _load_schemas(folder: Path, errors: list[str]) -> dict[str, dict[str, Any]]:
    import json

    schemas: dict[str, dict[str, Any]] = {}
    for p in sorted(folder.glob("*.json")):
        try:
            schema = json.loads(p.read_text("utf-8"))
            Draft202012Validator.check_schema(schema)
            _check_schema_subset(schema, f"schemas/{p.name}", errors)
            schemas[p.stem] = schema
        except (ValueError, SchemaError) as e:
            errors.append(f"schemas/{p.name}: invalid JSON Schema: {e}")
    return schemas


def _load_mode(path: Path, schemas: dict[str, Any], errors: list[str]) -> Mode | None:
    where = f"modes/{path.name}"
    meta, body = _front_matter(path.read_text("utf-8"), where, errors)
    if not meta:
        return None
    n_errors = len(errors)
    for key in REQUIRED_MODE_KEYS:
        if key not in meta:
            errors.append(f"{where}: missing key '{key}'")
    if meta.get("id") != path.stem:
        errors.append(f"{where}: id '{meta.get('id')}' must equal the file name '{path.stem}'")
    if meta.get("task") not in TASKS:
        errors.append(f"{where}: task '{meta.get('task')}' is not valid")
    if meta.get("pipeline") not in PIPELINES:
        errors.append(f"{where}: pipeline '{meta.get('pipeline')}' is not valid")
    if meta.get("task") == "MESSAGE" and meta.get("pipeline") is None:
        errors.append(f"{where}: MESSAGE modes need a pipeline")
    if meta.get("output") not in OUTPUTS:
        errors.append(f"{where}: output '{meta.get('output')}' is not valid")
    if meta.get("reference_data") not in REFERENCE_DATA:
        errors.append(f"{where}: reference_data '{meta.get('reference_data')}' is not valid")
    schema = meta.get("schema")
    if meta.get("output") == "json" and not schema:
        errors.append(f"{where}: json output needs a schema")
    if schema and schema not in schemas:
        errors.append(f"{where}: schema '{schema}' not found in schemas/")
    if meta.get("pipeline") in ("RAG", "WEB") and not meta.get("abstain_text"):
        errors.append(f"{where}: RAG/WEB modes need abstain_text")
    sections = _split_sections(body, where, errors)
    declared = set(meta.get("variables") or ())
    unknown = variables_in(body) - GLOBAL_VARIABLES - declared
    if unknown:
        errors.append(f"{where}: unknown variables {sorted(unknown)} (declare them in 'variables')")
    if len(errors) > n_errors:
        return None
    return Mode(
        id=meta["id"],
        version=int(meta["version"]),
        task=meta["task"],
        pipeline=meta["pipeline"],
        output=meta["output"],
        schema=schema,
        temperature=float(meta["temperature"]),
        max_output_tokens=int(meta["max_output_tokens"]),
        max_words=int(meta["max_words"]),
        reference_data=meta["reference_data"],
        instructions=sections.get("## Instructions", ""),
        example=sections.get("## Example") or None,
        reminder=sections.get("## Reminder", ""),
        abstain_text=meta.get("abstain_text"),
        stop=tuple(meta.get("stop") or ()),
        variables=tuple(declared),
    )


def _compile(patterns: dict[str, list[re.Pattern[str]]], key: str, sources: list[str], errors: list[str]) -> None:
    out = patterns.setdefault(key, [])
    for src in sources:
        try:
            out.append(re.compile(src, RE_FLAGS))
        except re.error as e:
            errors.append(f"{key}: regex {src!r} does not compile: {e}")


def _compile_all(harness: dict[str, Any], guard: dict[str, Any], errors: list[str]) -> dict[str, list[re.Pattern[str]]]:
    p: dict[str, list[re.Pattern[str]]] = {}
    for intent, srcs in (harness.get("router", {}).get("intents") or {}).items():
        _compile(p, f"router.{intent}", srcs, errors)
    router = harness.get("router", {})
    for key in ("followUpPatterns", "answerInKhmerPatterns", "answerInEnglishPatterns", "languageRequestStrip"):
        _compile(p, f"router.{key}", router.get(key) or [], errors)
    _compile(p, "retrieval.overview", harness.get("retrieval", {}).get("overviewPatterns") or [], errors)
    _compile(p, "grounding.meta", harness.get("grounding", {}).get("metaPatterns") or [], errors)
    _compile(p, "grounding.specificFacts", harness.get("grounding", {}).get("specificFactPatterns") or [], errors)
    for rule in guard.get("rules") or []:
        _compile(p, f"guard.rule.{rule.get('id')}", rule.get("patterns") or [], errors)
        _compile(p, f"guard.except.{rule.get('id')}", rule.get("exceptPatterns") or [], errors)
    for item in (guard.get("injection") or {}).get("patterns") or []:
        _compile(p, f"guard.injection.{item.get('id')}", [item["pattern"]], errors)
    for i, item in enumerate((guard.get("imagePolicy") or {}).get("blockPatterns") or []):
        _compile(p, f"guard.image.{i}", [item["pattern"]], errors)
    _compile(p, "guard.clientStop", guard.get("clientStopPatterns") or [], errors)
    for item in (guard.get("logMasking") or {}).get("patterns") or []:
        _compile(p, f"guard.mask.{item.get('name')}", [item["pattern"]], errors)
    invisible = ((guard.get("injection") or {}).get("untrustedText") or {}).get("stripInvisible") or []
    if invisible:
        _compile(p, "guard.invisible", ["[" + "".join(invisible) + "]"], errors)
    return p


def _load_suites(folder: Path, fixtures: dict[str, str], errors: list[str]) -> dict[str, EvalSuite]:
    suites: dict[str, EvalSuite] = {}
    for path in sorted((folder / "suites").glob("*.yaml")):
        where = f"evals/suites/{path.name}"
        data = yaml.safe_load(path.read_text("utf-8")) or {}
        seen: set[str] = set()
        cases: list[EvalCase] = []
        for raw in data.get("cases") or []:
            cid = raw.get("id")
            if not cid or cid in seen:
                errors.append(f"{where}: missing or duplicate case id '{cid}'")
                continue
            seen.add(cid)
            if raw.get("category") not in EVAL_CATEGORIES:
                errors.append(f"{where}: case '{cid}' has unknown category '{raw.get('category')}'")
            task_input = raw.get("taskInput") or {}
            fixture = task_input.get("lessonFixture")
            if fixture:
                if fixture not in fixtures:
                    errors.append(f"{where}: case '{cid}' uses missing fixture '{fixture}'")
                else:
                    task_input = {k: v for k, v in task_input.items() if k != "lessonFixture"}
                    task_input["lesson"] = fixtures[fixture]
                    raw = {**raw, "taskInput": task_input}
            for doc in raw.get("documents") or []:
                if doc not in fixtures:
                    errors.append(f"{where}: case '{cid}' uses missing fixture '{doc}'")
            cases.append(
                EvalCase(
                    id=cid,
                    category=raw.get("category", ""),
                    quick=bool(raw.get("quick")),
                    task=raw.get("task", "MESSAGE"),
                    raw=raw,
                )
            )
        suites[data.get("suite", path.stem)] = EvalSuite(
            id=data.get("suite", path.stem), version=int(data.get("version", 1)), cases=tuple(cases)
        )
    return suites


def rules_version(rules_dir: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(x for x in rules_dir.rglob("*") if x.is_file() and not x.name.startswith(".")):
        h.update(str(p.relative_to(rules_dir)).encode())
        h.update(p.read_bytes())
    return "rules-" + h.hexdigest()[:12]


def sample_variables(mode: Mode, app_name: str) -> dict[str, object]:
    """Values used to render every mode once at load time (NORMAL answer length)."""
    return {
        "APP_NAME": app_name,
        "TODAY": "8 November 2026",
        "WEEKDAY": "Sunday",
        "TIMEZONE": "Asia/Phnom_Penh",
        "ANSWER_LANGUAGE": "English",
        "MAX_WORDS": mode.max_words,
        "COUNT": 5,
        "SOURCE_LANGUAGE": "English",
        "TARGET_LANGUAGE": "Khmer",
        "EMERGENCY_LINE": "",
    }


def system_message(system: SystemPrompt, mode: Mode, values: dict[str, object], with_example: bool = True) -> str:
    """system_prompt + '## Your task' + Instructions (+ '## Example'), HARNESS.md §7.7."""
    text = render(system.body, values) + "\n\n## Your task\n" + render(mode.instructions, values)
    if with_example and mode.example:
        text += "\n\n## Example\n" + render(mode.example, values)
    return text


def load_rules(rules_dir: Path, app_name: str = "Lumen") -> Rules:
    errors: list[str] = []
    if not rules_dir.is_dir():
        raise RulesInvalid([f"RULES_DIR {rules_dir} does not exist"])

    def yaml_file(name: str) -> dict[str, Any]:
        try:
            data = yaml.safe_load((rules_dir / name).read_text("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("must be a mapping")
            return data
        except (OSError, ValueError, yaml.YAMLError) as e:
            errors.append(f"{name}: {e}")
            return {}

    harness = yaml_file("harness.yaml")
    guardrails = yaml_file("guardrails.yaml")
    models = yaml_file("models.yaml")
    system = _load_system(rules_dir / "system_prompt.md", errors)
    schemas = _load_schemas(rules_dir / "schemas", errors)
    modes: dict[str, Mode] = {}
    for path in sorted((rules_dir / "modes").glob("*.md")):
        mode = _load_mode(path, schemas, errors)
        if mode:
            modes[mode.id] = mode
    fixtures = {p.name: p.read_text("utf-8") for p in sorted((rules_dir / "evals" / "fixtures").glob("*.md"))}
    suites = _load_suites(rules_dir / "evals", fixtures, errors)
    patterns = _compile_all(harness, guardrails, errors)

    if harness.get("tokenEstimate"):
        for mode in modes.values():
            try:
                msg = system_message(system, mode, sample_variables(mode, app_name))
            except RulesRenderError as e:
                errors.append(f"modes/{mode.id}.md: {e}")
                continue
            tokens = est_tokens(msg, harness)
            if tokens > MAX_SYSTEM_TOKENS:
                errors.append(f"modes/{mode.id}.md: system message is ~{tokens} tokens (max {MAX_SYSTEM_TOKENS})")

    if errors:
        raise RulesInvalid(errors)
    return Rules(
        version=rules_version(rules_dir),
        loaded_at=datetime.now(UTC),
        system=system,
        modes=modes,
        schemas=schemas,
        harness=harness,
        guardrails=guardrails,
        models=models,
        suites=suites,
        fixtures=fixtures,
        patterns=patterns,
    )
