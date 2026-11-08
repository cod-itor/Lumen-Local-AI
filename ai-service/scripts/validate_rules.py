"""RULES.md §7 step 2: run every loader check and render every mode once.

Usage: uv run python scripts/validate_rules.py [--rules ../rules]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.harness.budget import est_tokens  # noqa: E402
from app.rules.loader import RulesInvalid, load_rules, sample_variables, system_message  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules", type=Path, default=Path(__file__).resolve().parent.parent.parent / "rules")
    args = parser.parse_args()
    try:
        rules = load_rules(args.rules.resolve())
    except RulesInvalid as e:
        print(f"FAILED — {len(e.errors)} problem(s):")
        for err in e.errors:
            print(f"  - {err}")
        return 1
    print(f"OK {rules.version}")
    for mode in rules.modes.values():
        tokens = est_tokens(system_message(rules.system, mode, sample_variables(mode, "Lumen")), rules.harness)
        print(f"  {mode.tag:<24} task={mode.task:<14} system≈{tokens} tokens")
    for suite in rules.suites.values():
        print(f"  suite {suite.id}@{suite.version}: {len(suite.cases)} cases ({suite.quick_count} quick)")
    print(f"  {sum(len(v) for v in rules.patterns.values())} regexes compiled, {len(rules.schemas)} schemas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
