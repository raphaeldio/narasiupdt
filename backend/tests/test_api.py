import json
import re

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import _extension_origin_regex, app

CASES = [
    ("v01", "BREAKING!! TNI akan menyerang Aceh pada 1 November 2026, warga diminta segera mengungsi. Sebarkan!", "hoax", True),
    ("v02", "Viral! Anggota Kodim 0612/Tasikmalaya memukuli warga saat razia warung obat Tramadol", "hoax", True),
    ("v03", "Pendaftaran Bintara TNI AD 2026 dibuka gratis lewat situs resmi rekrutmen TNI AD", "supported", True),
    ("v04", "TNI menggelar bakti sosial pengobatan gratis di Aceh pada 1 November 2026", "unverified", True),
    ("v05", "Prajurit TNI kini wajib bisa terbang tanpa pesawat mulai tahun depan #satire #parodi", "satire", True),
    ("v06", "Video latihan perang TNI di Natuna ini terjadi minggu lalu, tanda konflik sudah dimulai", "caution", True),
    ("v07", "Bangga banget lihat defile prajurit kita, keren!", "neutral", False),
    ("v08", "Minum air rebusan daun sirsak bisa menyembuhkan kanker dalam 3 hari", "hoax", False),
    ("v09", "Jembatan baru di Kendari akan diresmikan pada 12 Desember 2026", "unverified", False),
]


@pytest.fixture(scope="module")
def client(monkeypatch_module):
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def monkeypatch_module(tmp_path_factory):
    # Uji selalu dalam mode lokal, terlepas dari isi .env pengembang.
    mp = pytest.MonkeyPatch()
    mp.setenv("REPORTS_DB_PATH", str(tmp_path_factory.mktemp("db") / "test.db"))
    for key in ("GEMINI_API_KEY", "GROQ_API_KEY", "FACTCHECK_API_KEY", "TAVILY_API_KEY", "REDIS_URL", "DASHBOARD_TOKEN"):
        mp.setenv(key, "")
    get_settings.cache_clear()
    yield mp
    mp.undo()
    get_settings.cache_clear()


def run_session(client, video_id, caption, mode="caption"):
    r = client.post("/v1/analyze", json={"platform": "testbed", "video_id": video_id, "caption": caption, "mode": mode})
    assert r.status_code == 200
    body = r.json()
    if body["cached"]:
        return [("result", body["result"])], body
    events = []
    with client.stream("GET", f"/v1/analyze/{body['session_id']}/events") as stream:
        event = None
        for line in stream.iter_lines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                events.append((event, json.loads(line.split(":", 1)[1])))
    return events, body


def test_health_local_mode(client):
    assert client.get("/health").json()["mode"] == "local"


@pytest.mark.parametrize("video_id,caption,label,tni", CASES)
def test_testbed_cases(client, video_id, caption, label, tni):
    events, _ = run_session(client, f"case-{video_id}", caption)
    results = [d for e, d in events if e == "result"]
    final = results[-1]
    assert final["final"] is True
    assert final["label"] == label, (final["label"], final["claims"], final["evidence"])
    assert final["tni_related"] is tni
    if label in ("hoax", "caution", "supported"):
        assert final["score"] is not None and final["evidence"]
        assert all(e["url"] for e in final["evidence"])
        assert "[1]" in final["conclusion"]
    else:
        assert final["score"] is None


def test_second_request_hits_cache(client):
    run_session(client, "cache-me", CASES[0][1])
    events, body = run_session(client, "cache-me", CASES[0][1])
    assert body["cached"] is True and events[0][1]["label"] == "hoax"


def test_multimodal_without_providers_notes_skips(client):
    r = client.post("/v1/analyze", json={"platform": "testbed", "video_id": "mm", "caption": CASES[0][1]})
    sid = r.json()["session_id"]
    jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
    assert client.post(f"/v1/analyze/{sid}/frames", json={"frames": [jpeg]}).status_code == 202
    assert client.post(f"/v1/analyze/{sid}/complete").status_code == 202
    events = []
    with client.stream("GET", f"/v1/analyze/{sid}/events") as stream:
        for line in stream.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:]))
    final = [e for e in events if isinstance(e, dict) and e.get("final")][-1]
    assert final["label"] == "hoax"
    assert any("OCR" in n for n in final["notes"])


def test_bad_frame_rejected(client):
    r = client.post("/v1/analyze", json={"platform": "testbed", "video_id": "bad", "caption": "x"})
    sid = r.json()["session_id"]
    assert client.post(f"/v1/analyze/{sid}/frames", json={"frames": ["data:text/html;base64,PGI+"]}).status_code == 415


def test_stats_and_feedback(client):
    assert client.post("/v1/feedback", json={"platform": "testbed", "video_id": "v01"}).status_code == 202
    stats = client.get("/v1/stats").json()
    assert stats["total_checks"] >= 1 and stats["tni_checks"] >= 1 and stats["feedback_pending"] == 1


def test_timed_out_session_is_not_cached(client, monkeypatch):
    from app.main import app as fastapi_app

    monkeypatch.setattr(fastapi_app.state.pipeline.settings, "session_deadline", 0.3)
    r = client.post("/v1/analyze", json={"platform": "testbed", "video_id": "abandoned", "caption": CASES[0][1]})
    sid = r.json()["session_id"]  # multimodal, tetapi frame/audio/complete tidak pernah dikirim
    with client.stream("GET", f"/v1/analyze/{sid}/events") as stream:
        for _ in stream.iter_lines():
            pass
    again = client.post("/v1/analyze", json={"platform": "testbed", "video_id": "abandoned", "caption": CASES[0][1]})
    assert again.json()["cached"] is False


def scan(client, items, platform="testbed"):
    return client.post("/v1/scan", json={"platform": platform, "items": items})


@pytest.mark.parametrize("video_id,caption,label,tni", CASES)
def test_scan_matches_full_analysis_in_local_mode(client, video_id, caption, label, tni):
    # ID berbeda dari test_testbed_cases agar tidak terbaca dari cache hasil penuh.
    r = scan(client, [{"id": f"scan-{video_id}", "kind": "text", "text": caption}])
    assert r.status_code == 200
    [res] = r.json()["results"]
    assert res["id"] == f"scan-{video_id}"
    assert res["label"] == label
    assert res["tni_related"] is tni
    assert res["cached"] is False


def test_scan_uses_cached_full_result(client):
    run_session(client, "scan-cached", CASES[0][1])
    [res] = scan(client, [{"id": "scan-cached", "kind": "text", "text": "teks apa pun"}]).json()["results"]
    assert res["cached"] is True
    assert res["label"] == "hoax"


def test_scan_empty_text_is_unverified(client):
    [res] = scan(client, [{"id": "scan-empty", "kind": "image", "text": ""}]).json()["results"]
    # Tanpa teks tidak ada yang bisa dinilai: tetap "belum terverifikasi", bukan "tanpa klaim".
    assert res == {"id": "scan-empty", "label": "unverified", "score": None, "tni_related": False,
                   "claims": 0, "cached": False, "basis": "none", "topic": "umum", "language": "id", "risk": 0}


def test_scan_labels_beyond_unverified(client):
    """Scan tidak melulu "belum terverifikasi": pola bahasa, topik non-TNI, dan bahasa asing ikut dikenali."""
    items = [
        {"id": "s-pola", "kind": "text", "text": "Katanya besok semua ATM diblokir!! Sebarkan sebelum dihapus, "
                                                 "media menutupi kabar ini"},
        {"id": "s-santai", "kind": "text", "text": "Lagi ngopi santai sore sama teman-teman"},
        {"id": "s-asing", "kind": "text", "text": "The government has announced that all schools will close in 2027"},
    ]
    by_id = {r["id"]: r for r in scan(client, items).json()["results"]}
    assert by_id["s-pola"]["label"] == "caution" and by_id["s-pola"]["basis"] == "signals"
    assert by_id["s-pola"]["risk"] >= 45
    assert by_id["s-santai"]["label"] == "neutral"
    assert by_id["s-asing"]["language"] == "en" and by_id["s-asing"]["topic"] == "politik"


def test_full_analysis_reports_topics_language_and_risk(client):
    events, _ = run_session(client, "case-topik", "Minum air rebusan daun sirsak bisa menyembuhkan kanker dalam 3 hari")
    final = [d for e, d in events if e == "result"][-1]
    assert final["topics"][0] == "kesehatan" and final["language"] == "id"
    assert final["basis"] == "evidence" and final["risk"]["score"] > 0


def test_live_snapshot_and_actions(client):
    run_session(client, "case-live", CASES[0][1])
    live = client.get("/v1/live").json()
    types = {e["type"] for e in live["events"]}
    assert {"masuk", "klaim", "vonis"} <= types
    verdict = next(e for e in reversed(live["events"]) if e["type"] == "vonis" and e["key"] == "testbed:case-live")
    assert verdict["label"] == "hoax" and "pertahanan" in verdict["topics"]

    summary = client.get("/v1/summary").json()
    narrative = summary["narratives"][0]
    assert narrative["actions"] and narrative["sim"]["rate"] >= 0
    first = narrative["actions"][0]["id"]
    assert client.post("/v1/actions", json={"narrative": narrative["key"], "action": "tidak-ada"}).status_code == 422
    assert client.post("/v1/actions", json={"narrative": narrative["key"], "action": first}).status_code == 201
    again = client.get("/v1/summary").json()["narratives"][0]
    assert next(a for a in again["actions"] if a["id"] == first)["done"] is True


def test_scan_limits_batch_size(client):
    items = [{"id": f"scan-many-{i}", "kind": "text", "text": "x"} for i in range(11)]
    assert scan(client, items).status_code == 422


def test_scan_has_no_side_effects(client, monkeypatch):
    p = client.app.state.pipeline
    calls = []
    monkeypatch.setattr(p.reports, "record_view", lambda *a, **k: calls.append("view"))
    monkeypatch.setattr(p.stats, "record", lambda *a, **k: calls.append("stats"))

    async def no_find(claim):
        calls.append("find")
        return []

    monkeypatch.setattr(p.finder, "find", no_find)
    sessions = len(p.sessions)
    for _ in range(2):
        [res] = scan(client, [{"id": "scan-side", "kind": "text", "text": CASES[0][1]}]).json()["results"]
        assert res["cached"] is False  # scan tidak menulis cache hasil
    assert calls == []
    assert len(p.sessions) == sessions


def test_scan_isolates_item_errors(client, monkeypatch):
    p = client.app.state.pipeline
    original = p.finder.quick

    async def flaky(claim):
        if "Aceh" in claim.text:
            raise RuntimeError("boom")
        return await original(claim)

    monkeypatch.setattr(p.finder, "quick", flaky)
    results = scan(client, [
        {"id": "scan-bad", "kind": "text", "text": CASES[0][1]},
        {"id": "scan-good", "kind": "text", "text": CASES[7][1]},
    ]).json()["results"]
    assert [r["label"] for r in results] == ["error", "hoax"]


def test_extension_origin_is_locked_to_configured_ids():
    official = "a" * 32
    pattern = _extension_origin_regex([official, "bukan-id-valid"])
    assert re.fullmatch(pattern, f"chrome-extension://{official}")
    assert not re.fullmatch(pattern, f"chrome-extension://{'b' * 32}")
    assert re.fullmatch(_extension_origin_regex([]), f"chrome-extension://{'b' * 32}")
