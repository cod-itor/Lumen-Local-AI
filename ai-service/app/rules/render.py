"""Strict {{VAR}} rendering (RULES.md §3): unknown or leftover variables are errors, never sent to a model."""

import re

VAR_RE = re.compile(r"\{\{([A-Z][A-Z0-9_]*)\}\}")
ANY_BRACES_RE = re.compile(r"\{\{.*?\}\}")


class RulesRenderError(Exception):
    """A template used a variable nobody supplied — a bug, not a user error."""


def variables_in(text: str) -> set[str]:
    return set(VAR_RE.findall(text))


def render(template: str, values: dict[str, object]) -> str:
    def sub(m: re.Match[str]) -> str:
        name = m.group(1)
        if name not in values:
            raise RulesRenderError(f"RULES_RENDER_ERROR: no value for {{{{{name}}}}}")
        return str(values[name])

    out = VAR_RE.sub(sub, template)
    leftover = ANY_BRACES_RE.search(out)
    if leftover:
        raise RulesRenderError(f"RULES_RENDER_ERROR: unrendered {leftover.group(0)}")
    return out
