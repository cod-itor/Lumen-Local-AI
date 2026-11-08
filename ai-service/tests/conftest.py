import os
from pathlib import Path

import pytest

os.environ.setdefault("INTERNAL_TOKEN", "test-internal-token")
RULES_DIR = Path(__file__).resolve().parent.parent.parent / "rules"


@pytest.fixture(scope="session")
def rules():
    from app.rules.loader import load_rules

    return load_rules(RULES_DIR)


@pytest.fixture(scope="session", autouse=True)
def _loaded_rules(rules):
    """Every test sees the repo's rules as the active snapshot (app.state.rules())."""
    from app.state import set_rules

    set_rules(rules)
