"""Deterministic tools (HARNESS.md §6.1–6.2): calculator and date/time. Code computes; the model only copies.

The calculator never uses `eval`: expressions go through a whitelist `ast` walk with exact `Fraction` arithmetic.
"""

from __future__ import annotations

import ast
import math
import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, getcontext
from fractions import Fraction
from typing import Any

# ---------------------------------------------------------------- text with an origin map

_Spans = list[tuple[int, int]]


class _Mapped:
    """A rewritten string that remembers, for every character, the span of the original text it came from."""

    def __init__(self, text: str) -> None:
        self.text = text
        self.spans: _Spans = [(i, i + 1) for i in range(len(text))]

    def sub(self, pattern: re.Pattern[str], repl: Any) -> None:
        out: list[str] = []
        spans: _Spans = []
        last = 0
        for m in pattern.finditer(self.text):
            out.append(self.text[last : m.start()])
            spans += self.spans[last : m.start()]
            new = repl(m) if callable(repl) else m.expand(repl)
            a = self.spans[m.start()][0] if m.start() < len(self.spans) else len(self.text)
            b = self.spans[m.end() - 1][1] if m.end() > m.start() else a
            out.append(new)
            spans += [(a, b)] * len(new)
            last = m.end()
        out.append(self.text[last:])
        spans += self.spans[last:]
        self.text, self.spans = "".join(out), spans

    def origin(self, start: int, end: int) -> tuple[int, int]:
        return self.spans[start][0], self.spans[end - 1][1]


# ---------------------------------------------------------------- calculator detection (§6.1)

_W = re.IGNORECASE
_WORDS = [
    (re.compile(r"\bsquare root of\s*(\d+(?:\.\d+)?)", _W), r"sqrt(\1)"),
    (re.compile(r"\bto the power of\b", _W), "^"),
    (re.compile(r"\bmultiplied by\b", _W), "*"),
    (re.compile(r"\bdivided by\b", _W), "/"),
    (re.compile(r"\bplus\b", _W), "+"),
    (re.compile(r"\bminus\b", _W), "-"),
    (re.compile(r"\btimes\b", _W), "*"),
    (re.compile(r"\s*\bsquared\b", _W), "^2"),
    (re.compile(r"\s*\bcubed\b", _W), "^3"),
]
_THOUSANDS = re.compile(r"(?<=\d),(?=\d{3}(?!\d))")
_X_BETWEEN = re.compile(r"(?<=\d)\s*[xX×]\s*(?=\d)")
_PERCENT_OF = re.compile(r"(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)", _W)
_PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
_DATES_TIMES = re.compile(r"\d{4}-\d{1,2}-\d{1,2}|\d{1,2}/\d{1,2}/\d{2,4}|\d{1,2}:\d{2}")
_CANDIDATE = re.compile(r"(?:sqrt\(|[\d.+\-*/^() ])+")
_HAS_OP = re.compile(r"[\d)]\s*[-+*/^]\s*[\d(s]")
_RANGE = re.compile(r"\d+-\d+")
_CUES = re.compile(
    r"\b(calculate|compute|solve|evaluate|what is|what's|how much|how many|equals?)\b|=|ប៉ុន្មាន", re.IGNORECASE
)


@dataclass
class Calc:
    display: str  # the user's own spelling: "1234 × 5678"
    expression: str  # normalized: "1234*5678"
    result: str  # "7006652", "too large", "undefined (division by zero)"
    numeric: bool


def find_expressions(text: str, cfg: dict[str, Any]) -> list[Calc]:
    m = _Mapped(text)
    for pat, rep in _WORDS:
        m.sub(pat, rep)
    m.sub(re.compile("÷"), "/")
    m.sub(re.compile(r"\*\*"), "^")
    m.sub(_X_BETWEEN, "*")
    m.sub(_THOUSANDS, "")
    m.sub(_PERCENT_OF, lambda x: f"({x.group(1)}/100*{x.group(2)})")
    m.sub(_PERCENT, lambda x: f"({x.group(1)}/100)")
    m.sub(_DATES_TIMES, lambda x: " " * len(x.group(0)))

    non_space = len(re.sub(r"\s", "", text)) or 1
    cue = bool(_CUES.search(text))
    out: list[Calc] = []
    for c in _CANDIDATE.finditer(m.text):
        raw = c.group(0)
        lead = len(raw) - len(raw.lstrip())
        expr = raw.strip()
        if not expr:
            continue
        # balance: drop unmatched outer parentheses picked up from the surrounding text
        while expr.count("(") > expr.count(")") and expr.startswith("("):
            expr, lead = expr[1:].lstrip(), lead + 1 + (len(expr[1:]) - len(expr[1:].lstrip()))
        while expr.count(")") > expr.count("(") and expr.endswith(")"):
            expr = expr[:-1].rstrip()
        if not (int(cfg["minExpressionChars"]) <= len(expr) <= int(cfg["maxExpressionChars"])):
            continue
        if not _HAS_OP.search(expr) or _RANGE.fullmatch(expr):
            continue
        start = c.start() + lead
        a, b = m.origin(start, start + len(expr))
        display = " ".join(text[a:b].split())
        covers = len(re.sub(r"\s", "", text[a:b])) / non_space >= 0.6
        if not (cue or covers):
            continue
        result, numeric = evaluate(expr, cfg)
        if result is None:
            continue
        out.append(Calc(display=display, expression=expr, result=result, numeric=numeric))
        if len(out) >= int(cfg["maxExpressions"]):
            break
    return out


# ---------------------------------------------------------------- evaluation


class _TooLarge(Exception):
    pass


class _DivZero(Exception):
    pass


class _Reject(Exception):
    pass


def evaluate(expr: str, cfg: dict[str, Any]) -> tuple[str | None, bool]:
    """(formatted result, numeric) or (None, False) if the whitelist rejects the expression."""
    try:
        tree = ast.parse(expr.replace("^", "**"), mode="eval")
    except SyntaxError:
        return None, False
    max_exp = int(cfg["maxExponent"])
    max_mag = Fraction(Decimal(str(cfg["maxMagnitude"])))
    getcontext().prec = 40

    def check(v: Fraction | Decimal) -> Fraction | Decimal:
        if abs(v) > max_mag:
            raise _TooLarge
        return v

    def num(v: Fraction | Decimal) -> Decimal:
        return v if isinstance(v, Decimal) else Decimal(v.numerator) / Decimal(v.denominator)

    def walk(n: ast.AST) -> Fraction | Decimal:
        if isinstance(n, ast.Expression):
            return walk(n.body)
        if isinstance(n, ast.Constant) and type(n.value) in (int, float):
            return check(Fraction(repr(n.value)))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
            v = walk(n.operand)
            return -v if isinstance(n.op, ast.USub) else v
        if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            a, b = walk(n.left), walk(n.right)
            if isinstance(n.op, ast.Pow):
                if abs(b) > max_exp:
                    raise _TooLarge
                if isinstance(b, Fraction) and b.denominator == 1 and isinstance(a, Fraction):
                    if a == 0 and b < 0:
                        raise _DivZero
                    return check(a ** int(b))
                if num(a) < 0:
                    raise _Reject  # complex result
                return check(num(a) ** num(b))
            if isinstance(a, Decimal) or isinstance(b, Decimal):
                a, b = num(a), num(b)
            if isinstance(n.op, ast.Add):
                return check(a + b)
            if isinstance(n.op, ast.Sub):
                return check(a - b)
            if isinstance(n.op, ast.Mult):
                return check(a * b)
            if b == 0:
                raise _DivZero
            return check(a / b)
        if (
            isinstance(n, ast.Call)
            and isinstance(n.func, ast.Name)
            and n.func.id == "sqrt"
            and len(n.args) == 1
            and not n.keywords
        ):
            v = num(walk(n.args[0]))
            if v < 0:
                raise _Reject
            return check(v.sqrt())
        raise _Reject

    try:
        value = walk(tree)
    except _TooLarge:
        return "too large", False
    except _DivZero:
        return "undefined (division by zero)", False
    except (_Reject, InvalidOperation, OverflowError, ValueError, ZeroDivisionError):
        return None, False
    return fmt(value, int(cfg["significantDigits"])), True


def fmt(v: Fraction | Decimal, digits: int) -> str:
    if isinstance(v, Fraction) and v.denominator == 1:
        return str(v.numerator)
    d = v if isinstance(v, Decimal) else Decimal(v.numerator) / Decimal(v.denominator)
    if d == d.to_integral_value() and abs(d) < Decimal(10) ** 30:
        return str(int(d))
    if d == 0:
        return "0"
    exp = math.floor(math.log10(abs(float(d))))
    q = Decimal(1).scaleb(exp - digits + 1)
    s = format(d.quantize(q), "f")
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return s


# ---------------------------------------------------------------- date and time (§6.2)

MONTHS = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
]
_MON = "|".join(MONTHS)
_D_MONTH_Y = re.compile(rf"\b(\d{{1,2}})\s+({_MON})\s+(\d{{4}})\b", _W)
_MONTH_D_Y = re.compile(rf"\b({_MON})\s+(\d{{1,2}}),?\s+(\d{{4}})\b", _W)
_ISO = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
_DMY = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
_UNTIL = re.compile(r"\bhow many days (until|till|to|before|from now (until|to))\b", _W)
_BETWEEN = re.compile(r"\bbetween\b", _W)


def long_date(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1].capitalize()} {d.year}"


def find_dates(text: str) -> list[date]:
    found: list[tuple[int, date]] = []

    def add(pos: int, y: int, mo: int, d: int) -> None:
        try:
            found.append((pos, date(y, mo, d)))
        except ValueError:
            pass

    for m in _D_MONTH_Y.finditer(text):
        add(m.start(), int(m.group(3)), MONTHS.index(m.group(2).lower()) + 1, int(m.group(1)))
    for m in _MONTH_D_Y.finditer(text):
        add(m.start(), int(m.group(3)), MONTHS.index(m.group(1).lower()) + 1, int(m.group(2)))
    for m in _ISO.finditer(text):
        add(m.start(), int(m.group(1)), int(m.group(2)), int(m.group(3)))
    for m in _DMY.finditer(text):  # day-first
        add(m.start(), int(m.group(3)), int(m.group(2)), int(m.group(1)))
    seen: list[date] = []
    for _, d in sorted(found, key=lambda x: x[0]):
        if d not in seen:
            seen.append(d)
    return seen


def datetime_results(text: str, now: datetime, tz_name: str) -> list[dict[str, str]]:
    out = [
        {
            "tool": "DATETIME",
            "input": "Current date and time",
            "output": f"{now:%A}, {long_date(now.date())}, {now:%H:%M} ({tz_name})",
        }
    ]
    dates = find_dates(text)
    today = now.date()
    if len(dates) >= 2 and _BETWEEN.search(text):
        a, b = dates[0], dates[1]
        out.append(
            {
                "tool": "DATETIME",
                "input": f"Days between {long_date(a)} and {long_date(b)}",
                "output": str(abs((b - a).days)),
            }
        )
    elif dates and _UNTIL.search(text):
        d = dates[0]
        out.append(
            {
                "tool": "DATETIME",
                "input": f"Days from today ({long_date(today)}) to {long_date(d)}",
                "output": str((d - today).days),
            }
        )
    for d in dates[:2]:
        out.append({"tool": "DATETIME", "input": f"Day of the week for {long_date(d)}", "output": f"{d:%A}"})
    return out


def line(t: dict[str, str]) -> str:
    """The TOOL RESULTS line (§7.7)."""
    return f"{t['input']} = {t['output']}" if t["tool"] == "CALCULATOR" else f"{t['input']}: {t['output']}"


def run_tools(original: str, model_input: str, intents: list[str], now: datetime, tz_name: str, cfg: dict[str, Any]):
    """P8: ToolResultDto[] for the turn (MATH and DATETIME intents)."""
    results: list[dict[str, str]] = []
    if "MATH" in intents:
        calcs = find_expressions(model_input, cfg["calculator"])
        if not calcs and original != model_input:
            calcs = find_expressions(original, cfg["calculator"])
        results += [{"tool": "CALCULATOR", "input": c.display, "output": c.result} for c in calcs]
    if "DATETIME" in intents:
        results += datetime_results(model_input, now, tz_name)
    return results


def has_math(original: str, model_input: str, cfg: dict[str, Any]) -> bool:
    return bool(find_expressions(model_input, cfg["calculator"]) or find_expressions(original, cfg["calculator"]))


def enforce_calculator(text: str, tools: list[dict[str, Any]]) -> str:
    """F12: append the exact result when the answer does not contain it."""
    plain = re.sub(r"(?<=\d)[,  ](?=\d{3}\b)", "", text)
    missing = [
        t
        for t in tools
        if t.get("tool") == "CALCULATOR"
        and re.fullmatch(r"-?\d+(\.\d+)?", str(t.get("output")))
        and not re.search(rf"(?<![\d.]){re.escape(str(t['output']))}(?![\d])", plain)
    ]
    for t in missing:
        text = f"{text.rstrip()}\n\n**Exact result:** {t['input']} = {t['output']}"
    return text
