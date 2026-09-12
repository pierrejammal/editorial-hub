"""Backend tests for FORSIDES News Studio API (job-based flow)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()
API = f"{BASE_URL}/api"

JOB_POLL_TIMEOUT = 240  # seconds
HTTP_TIMEOUT = 60


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def run_job(session, path, payload, timeout=JOB_POLL_TIMEOUT):
    r = session.post(f"{API}{path}", json=payload, timeout=HTTP_TIMEOUT)
    assert r.status_code == 200, f"start job failed {r.status_code}: {r.text}"
    job_id = r.json().get("job_id")
    assert job_id, f"no job_id: {r.text}"
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(3)
        pr = session.get(f"{API}/jobs/{job_id}", timeout=30)
        assert pr.status_code == 200, pr.text
        doc = pr.json()
        status = doc.get("status")
        if status == "done":
            return doc.get("result"), doc
        if status == "error":
            return None, doc
    pytest.fail(f"job {job_id} did not complete within {timeout}s")


# --- Health ---
def test_root(session):
    r = session.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    assert "message" in r.json()


# --- Search (job flow) ---
@pytest.fixture(scope="module")
def search_result(session):
    result, doc = run_job(session, "/jobs/search",
                          {"topic": "Publications EIOPA Solvabilit\u00e9 II", "max_results": 5})
    assert doc.get("status") == "done", f"search failed: {doc}"
    return result


def test_search_shape(search_result):
    assert search_result.get("candidates_count", 0) > 0
    topics = search_result.get("topics", [])
    assert 3 <= len(topics) <= 6, f"expected 3-6 topics, got {len(topics)}"
    for t in topics:
        for k in ("id", "title", "source", "source_url", "date", "summary",
                  "why_attention", "main_insight", "priority", "score", "scoring"):
            assert k in t, f"missing key {k}"
        assert 0 <= int(t["score"]) <= 100
    scores = [int(t["score"]) for t in topics]
    assert scores == sorted(scores, reverse=True), f"topics not score-desc: {scores}"


def test_search_exclude(session, search_result):
    excluded = [t["title"] for t in search_result["topics"][:3]]
    result, doc = run_job(session, "/jobs/search",
                          {"topic": "Publications EIOPA Solvabilit\u00e9 II",
                           "max_results": 5, "exclude": excluded})
    assert doc.get("status") == "done", f"exclude search failed: {doc}"
    new_titles = [t["title"] for t in result.get("topics", [])]
    overlap = set(new_titles) & set(excluded)
    assert len(overlap) < len(excluded), f"refresh returned same titles: {overlap}"


# --- Analyze topic (job) ---
def test_analyze_topic(session, search_result):
    topic = search_result["topics"][0]
    result, doc = run_job(session, "/jobs/analyze-topic",
                          {"topic": topic, "length": "standard"})
    assert doc.get("status") == "done", f"analyze-topic failed: {doc}"
    for k in ("meta", "scoring", "editorial", "visual", "caption", "quality", "sources"):
        assert k in result, f"missing {k}"
    assert isinstance(result["caption"], str) and len(result["caption"]) > 200
    sc = result["scoring"]
    for sk in ("pertinence", "impact", "actualite", "fiabilite", "linkedin",
               "vulgarisation", "originalite", "total", "classification",
               "strengths", "weaknesses", "recommendation"):
        assert sk in sc, f"scoring missing {sk}"
    ed = result["editorial"]
    for ek in ("fact", "what_changes", "why_important", "insight", "key_figure",
               "angle", "angle_options"):
        assert ek in ed
    vi = result["visual"]
    for vk in ("recommended_format", "title_short", "data_points",
               "key_figure_value", "important_date", "insight_line"):
        assert vk in vi
    q = result["quality"]
    assert 0 <= int(q["score"]) <= 100
    pytest.studio_context = {
        "fact": ed["fact"], "what_changes": ed["what_changes"],
        "why_important": ed["why_important"], "insight": ed["insight"],
        "key_figure": ed.get("key_figure", ""), "angle": ed.get("angle", ""),
        "source": result["meta"].get("source", ""),
    }
    pytest.baseline_caption = result["caption"]


# --- Compose (job) ---
def test_compose(session):
    caption_text = (
        "L'EIOPA a publi\u00e9 le 15 janvier 2026 sa r\u00e9vision de Solvabilit\u00e9 II. "
        "L'exigence de capital passe \u00e0 8,5% pour les assureurs vie, un tournant "
        "majeur pour l'industrie europ\u00e9enne qui devra recalibrer ses mod\u00e8les internes."
    )
    result, doc = run_job(session, "/jobs/compose", {"caption": caption_text})
    assert doc.get("status") == "done", f"compose failed: {doc}"
    assert "visual" in result
    v = result["visual"]
    for k in ("recommended_format", "title_short", "data_points",
              "key_figure_value", "important_date"):
        assert k in v, f"visual missing {k}"
    assert isinstance(v["title_short"], str) and len(v["title_short"]) > 3
    assert result.get("caption", "") == caption_text


# --- Analyze URL (job) ---
def test_analyze_url(session):
    url = "https://www.eiopa.europa.eu/index_en"
    result, doc = run_job(session, "/jobs/analyze-url",
                          {"url": url, "length": "standard"})
    status = doc.get("status")
    if status == "error":
        pytest.skip(f"URL scrape unavailable: {doc.get('detail')}")
    assert status == "done", f"analyze-url failed: {doc}"
    assert "meta" in result and "caption" in result and "scoring" in result


# --- Caption (direct, plain text) ---
def test_caption_shorten(session):
    ctx = getattr(pytest, "studio_context", None)
    baseline = getattr(pytest, "baseline_caption", None)
    if not ctx or not baseline:
        pytest.skip("no baseline")
    r = session.post(f"{API}/caption", json={
        "context": ctx, "length": "court", "action": "shorten",
        "current_caption": baseline,
    }, timeout=HTTP_TIMEOUT)
    assert r.status_code == 200, r.text
    new = r.json()["caption"]
    assert isinstance(new, str) and len(new) > 50
    # No JSON fencing / wrapper
    assert not new.lstrip().startswith("{")
    assert "```" not in new
    assert len(new) < len(baseline), f"shorten did not reduce ({len(new)} vs {len(baseline)})"


def test_caption_analytical_longer_than_shorten(session):
    ctx = getattr(pytest, "studio_context", None)
    if not ctx:
        pytest.skip("no ctx")
    r_sh = session.post(f"{API}/caption", json={
        "context": ctx, "length": "court", "action": "shorten",
    }, timeout=HTTP_TIMEOUT)
    r_an = session.post(f"{API}/caption", json={
        "context": ctx, "length": "analytique", "action": "analytical",
    }, timeout=HTTP_TIMEOUT)
    assert r_sh.status_code == 200 and r_an.status_code == 200
    sh = r_sh.json()["caption"]
    an = r_an.json()["caption"]
    assert len(an) > len(sh), f"analytique should exceed court ({len(an)} vs {len(sh)})"


def test_caption_change_angle(session):
    ctx = getattr(pytest, "studio_context", None)
    baseline = getattr(pytest, "baseline_caption", None)
    if not ctx:
        pytest.skip("no ctx")
    r = session.post(f"{API}/caption", json={
        "context": ctx, "length": "standard", "action": "change_angle",
        "angle": "Le chiffre \u00e0 retenir", "current_caption": baseline,
    }, timeout=HTTP_TIMEOUT)
    assert r.status_code == 200, r.text
    assert len(r.json()["caption"]) > 100


# --- Quality ---
def test_quality(session):
    ctx = getattr(pytest, "studio_context", None)
    baseline = getattr(pytest, "baseline_caption", None)
    if not ctx or not baseline:
        pytest.skip()
    r = session.post(f"{API}/quality", json={"caption": baseline, "context": ctx},
                     timeout=HTTP_TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert 0 <= int(d["score"]) <= 100
    for k in ("veracite", "nouveaute", "interet", "clarte", "originalite", "style"):
        assert k in d["criteria"]


# --- Visual image (Gemini) ---
def test_visual_image(session):
    r = session.post(f"{API}/visual-image", json={
        "title": "Solvabilit\u00e9 II: EIOPA publie sa r\u00e9vision",
        "sector": "assurance", "topic": "r\u00e9forme prudentielle",
        "angle": "Alerte r\u00e9glementaire",
    }, timeout=HTTP_TIMEOUT)
    assert r.status_code == 200, r.text
    img = r.json().get("image", "")
    assert img.startswith("data:image/") and ";base64," in img
    assert len(img) > 1000
