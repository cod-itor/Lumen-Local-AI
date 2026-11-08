import os
from pathlib import Path

import pytest

os.environ.setdefault("INTERNAL_TOKEN", "test-internal-token")
RULES_DIR = Path(__file__).resolve().parent.parent.parent / "rules"


@pytest.fixture(scope="session")
def rules():
    from app.rules.loader import load_rules

    return load_rules(RULES_DIR)
