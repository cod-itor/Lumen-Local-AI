"""Calculator and date tools: the reference behaviour of HARNESS.md §6.1–6.2."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.harness.tools import datetime_results, enforce_calculator, find_expressions
from app.state import rules


def calc(text: str) -> list[tuple[str, str]]:
    return [(c.display, c.result) for c in find_expressions(text, rules().harness["tools"]["calculator"])]


@pytest.mark.parametrize(
    "text,display,result",
    [
        ("What is 1234 × 5678?", "1234 × 5678", "7006652"),
        ("what is 15% of 240", "15% of 240", "36"),
        ("Calculate (125 + 375) / 4", "(125 + 375) / 4", "125"),
        ("what is 10 minus 3 times 2", "10 minus 3 times 2", "4"),
        ("What is the square root of 144 plus 6?", "square root of 144 plus 6", "18"),
        ("compute 1,000 + 2,500", "1,000 + 2,500", "3500"),
        ("2+2", "2+2", "4"),
        ("what is 1/3", "1/3", "0.3333333333"),
        ("what is 2^100", "2^100", "too large"),
        ("what is 5 / 0", "5 / 0", "undefined (division by zero)"),
        ("how much is 12 x 3", "12 x 3", "36"),
        ("what is 2 ** 10", "2 ** 10", "1024"),
        ("what is 0.1 + 0.2", "0.1 + 0.2", "0.3"),
    ],
)
def test_calculator(text, display, result):
    assert calc(text) == [(display, result)]


@pytest.mark.parametrize(
    "text",
    [
        "Read pages 3-4 for tomorrow",
        "The class starts at 7:30",
        "My exam is on 25/12/2026",
        "What happened on 2026-11-08?",
        "I am in grade 10",
        "Tell me about COVID-19",
        "Children aged 5 - 7 can join the club",
        "__import__('os').system('ls')",
    ],
)
def test_no_tool(text):
    assert calc(text) == []


def test_never_eval():
    assert calc("what is (lambda: 1)() + 2") == [] or all(r != "3" for _, r in calc("what is (lambda: 1)() + 2"))


NOW = datetime(2026, 11, 8, 1, 30, tzinfo=ZoneInfo("Asia/Phnom_Penh"))


def test_datetime_lines():
    out = datetime_results("How many days until 25 December 2026?", NOW, "Asia/Phnom_Penh")
    lines = [f"{t['input']}: {t['output']}" for t in out]
    assert lines[0] == "Current date and time: Sunday, 8 November 2026, 01:30 (Asia/Phnom_Penh)"
    assert "Days from today (8 November 2026) to 25 December 2026: 47" in lines
    assert "Day of the week for 25 December 2026: Friday" in lines


@pytest.mark.parametrize("text", ["What day is December 25, 2026?", "what day is 2026-12-25", "what day is 25/12/2026"])
def test_date_formats(text):
    out = datetime_results(text, NOW, "Asia/Phnom_Penh")
    assert {"tool": "DATETIME", "input": "Day of the week for 25 December 2026", "output": "Friday"} in out


def test_days_between():
    out = datetime_results("How many days between 1 January 2026 and 1 March 2026?", NOW, "UTC")
    assert {"tool": "DATETIME", "input": "Days between 1 January 2026 and 1 March 2026", "output": "59"} in out


def test_enforce_calculator():
    tools = [{"tool": "CALCULATOR", "input": "1234 × 5678", "output": "7006652"}]
    assert enforce_calculator("It is 7,006,652.", tools) == "It is 7,006,652."
    fixed = enforce_calculator("It is about 7 million.", tools)
    assert fixed.endswith("**Exact result:** 1234 × 5678 = 7006652")
