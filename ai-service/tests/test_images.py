"""Image job validation (AI_SERVICE.md §10): paths stay inside STORAGE_DIR, sizes and steps are bounded."""

import pytest

from app.api import images
from app.config import get_settings
from app.errors import ServiceError


@pytest.fixture
def on(monkeypatch):
    monkeypatch.setattr(images, "features", lambda s: {"images": True, "bgRemoval": True})


def body(**kw):
    return {"prompt": "A red bicycle", "width": 1024, "height": 1024, "outputPaths": ["users/u/images/a.png"], **kw}


def test_valid_job_resolves_paths(on):
    job = images._job(body(seed=7))
    root = get_settings().storage_dir.resolve()
    assert job["outputs"][0] == root / "users/u/images/a.png"
    assert job["seed"] == 7 and job["steps"] == 4


@pytest.mark.parametrize(
    "bad",
    [
        {"prompt": ""},
        {"prompt": "x" * 1001},
        {"width": 1000},
        {"height": 2048},
        {"steps": 9},
        {"outputPaths": []},
        {"outputPaths": ["a.png"] * 5},
        {"outputPaths": ["../../etc/passwd.png"]},
        {"outputPaths": ["users/u/images/a.jpg"]},
        {"outputPaths": ["/var/data/x.png"]},
    ],
)
def test_invalid_job(on, bad):
    with pytest.raises(ServiceError) as e:
        images._job(body(**bad))
    assert e.value.code == "VALIDATION_ERROR"


def test_feature_off(monkeypatch):
    monkeypatch.setattr(images, "features", lambda s: {"images": False, "bgRemoval": True})
    with pytest.raises(ServiceError) as e:
        images._job(body())
    assert e.value.code == "FEATURE_UNAVAILABLE"
