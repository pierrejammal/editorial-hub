"""Backend tests for FORSIDES History: /api/posts/save, /api/posts, /api/post/{id}, DELETE /api/posts/{id}."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _payload(scheduled=None, title="TEST_history_post"):
    return {
        "title": title,
        "caption": "Contenu de test pour l'historique.",
        "thumbnail": "data:image/jpeg;base64,AAA",
        "meta": {"source": "ACPR", "date_label": "JANVIER 2026"},
        "scoring": {"total": 88, "pertinence": {"score": 18}},
        "visual": {"recommended_format": "A", "title_short": "Titre court"},
        "origin": "studio",
        "scheduled_at": scheduled,
    }


def test_save_returns_id(session):
    r = session.post(f"{API}/posts/save", json=_payload(scheduled="2026-07-01T09:00:00Z"), timeout=30)
    assert r.status_code == 200, r.text
    pid = r.json().get("id")
    assert pid and isinstance(pid, str)
    pytest.saved_id = pid


def test_list_posts_contains_saved(session):
    pid = getattr(pytest, "saved_id", None)
    assert pid, "no saved id"
    r = session.get(f"{API}/posts", timeout=30)
    assert r.status_code == 200, r.text
    posts = r.json().get("posts", [])
    match = [p for p in posts if p.get("id") == pid]
    assert match, f"saved post {pid} not in list"
    p = match[0]
    assert p.get("title") == "TEST_history_post"
    assert p.get("meta", {}).get("source") == "ACPR"
    assert p.get("scoring", {}).get("total") == 88
    assert p.get("scheduled_at") == "2026-07-01T09:00:00Z"
    assert "thumbnail" in p


def test_get_full_post(session):
    pid = getattr(pytest, "saved_id", None)
    assert pid
    r = session.get(f"{API}/post/{pid}", timeout=30)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["id"] == pid
    assert doc["caption"].startswith("Contenu")
    assert doc["visual"]["recommended_format"] == "A"
    assert doc.get("saved") is True
    assert "_id" not in doc


def test_upsert_same_id(session):
    pid = getattr(pytest, "saved_id", None)
    assert pid
    body = _payload(title="TEST_updated_title")
    body["id"] = pid
    r = session.post(f"{API}/posts/save", json=body, timeout=30)
    assert r.status_code == 200
    assert r.json()["id"] == pid
    g = session.get(f"{API}/post/{pid}", timeout=30).json()
    assert g["title"] == "TEST_updated_title"


def test_delete_removes(session):
    pid = getattr(pytest, "saved_id", None)
    assert pid
    r = session.delete(f"{API}/posts/{pid}", timeout=30)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    g = session.get(f"{API}/post/{pid}", timeout=30)
    assert g.status_code == 404
    lst = session.get(f"{API}/posts", timeout=30).json().get("posts", [])
    assert not any(p.get("id") == pid for p in lst)
