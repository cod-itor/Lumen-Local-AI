from fastapi.testclient import TestClient

from app.main import app

H = {"X-Internal-Token": "test-internal-token"}


def test_token_required_and_endpoints():
    with TestClient(app) as c:
        assert c.get("/health").status_code == 401
        h = c.get("/health", headers=H).json()
        assert h["status"] == "ok" and h["profile"] in ("full", "lite")
        cap = c.get("/capabilities", headers=H).json()
        assert cap["embedDim"] == 768 and cap["rulesVersion"].startswith("rules-")
        prof = c.post("/models/profile", headers=H, json={"kind": "HOST", "model": "llama3.2"}).json()
        assert prof["family"] == "llama3.2"
        cat = c.get("/models/catalog", headers=H).json()
        assert cat["browser"]["models"][0]["recommended"] is True
        suites = c.get("/evals/suites", headers=H).json()
        assert suites[0]["fullCount"] == 48
        assert c.post("/rules/reload", headers=H).status_code == 200
