import time

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.models import AnalysisResult, Claim
from app.notifier import Notifier, format_alert
from app.reports import ReportStore, alert_level, priority_of

HOAX_TNI = "BREAKING!! TNI akan menyerang Aceh pada 1 November 2026, warga diminta segera mengungsi."


def result(video_id="x1", label="hoax", score=90, tni=True) -> AnalysisResult:
    return AnalysisResult(platform="testbed", video_id=video_id, stage="final", final=True, score=score, label=label,
                          confidence="high", tni_related=tni, claims=[], evidence=[], conclusion=None)


def test_priority_and_levels():
    assert priority_of("hoax", True, 0, 0) == 3.0
    assert priority_of("hoax", True, 7, 0) == 12.0  # 3 * (1 + log2 8)
    assert priority_of("supported", True, 50, 0) == 0.0
    assert alert_level(12, 0) == "tinggi"
    assert alert_level(3, 1) == "sedang"
    assert alert_level(3, 0) == "rendah"


def test_rising_video_is_flagged_before_reports(tmp_path):
    store = ReportStore(str(tmp_path / "r.db"), "salt")
    store.record_result(result())
    for i in range(6):
        store.record_view("testbed", "x1", "http://t/x1", f"install-{i}")
    store.record_view("testbed", "x1", "http://t/x1", "install-0")  # penonton sama tidak dihitung dua kali
    [alert] = store.alerts()
    assert alert["viewers_1h"] == 6 and alert["rising"] and alert["level"] == "tinggi"
    store.close()


def test_non_tni_issues_are_queued_with_lower_priority_and_supported_is_not(tmp_path):
    store = ReportStore(str(tmp_path / "r.db"), "salt")
    store.record_result(result("a", tni=False))
    store.record_result(result("b", label="supported", score=0))
    store.record_result(result("c"))
    queued = {a["video_id"]: a for a in store.alerts()}
    # Semua isu masuk antrean, tapi isu non-TNI bobotnya separuh; konten yang didukung sumber tidak ikut.
    assert set(queued) == {"a", "c"}
    assert queued["a"]["priority"] < queued["c"]["priority"]
    assert store.alerts(include_non_tni=False)[0]["video_id"] == "c" and len(store.alerts(include_non_tni=False)) == 1
    store.close()


def test_report_uses_server_result_and_hides_reporter(tmp_path):
    store = ReportStore(str(tmp_path / "r.db"), "salt")
    store.record_result(result())
    forged = result(label="supported", score=0)
    report = store.add_report(platform="testbed", video_id="x1", url="http://t/x1", reason="mencatut_tni",
                              note="", install_id="abc", client_result=forged)
    assert report["label"] == "hoax" and "reporter" not in report
    updated = store.update_report(report["id"], "ditinjau", "diteruskan ke Pendam")
    assert updated["status"] == "ditinjau" and updated["status_note"] == "diteruskan ke Pendam"
    store.close()


def test_alert_message_is_readable():
    text = format_alert({"level": "tinggi", "platform": "tiktok", "label": "hoax", "score": 88, "tni_related": True,
                         "viewers_1h": 12, "viewers_prev_1h": 2, "rising": True, "reports": 1,
                         "claim": "TNI akan menyerang Aceh", "url": "https://tiktok.com/x"}, "Laporan pengguna")
    assert "TINGGI" in text and "NAIK CEPAT" in text and "88%" in text and "terkait TNI" in text


@pytest.fixture()
def client(tmp_path, monkeypatch):
    for key in ("GEMINI_API_KEY", "GROQ_API_KEY", "FACTCHECK_API_KEY", "TAVILY_API_KEY", "REDIS_URL"):
        monkeypatch.setenv(key, "")
    monkeypatch.setenv("REPORTS_DB_PATH", str(tmp_path / "api.db"))
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://hooks.example.test/narasi")
    monkeypatch.setenv("DASHBOARD_TOKEN", "rahasia")
    get_settings.cache_clear()
    sent = []

    async def fake_send(self, alert, reason):
        sent.append((alert["level"], reason))

    monkeypatch.setattr(Notifier, "send", fake_send)
    with TestClient(app) as c:
        c.sent = sent
        yield c
    get_settings.cache_clear()


def analyze(client, video_id, install):
    r = client.post("/v1/analyze", headers={"X-Narasi-Install": install},
                    json={"platform": "testbed", "video_id": video_id, "caption": HOAX_TNI, "mode": "caption"})
    body = r.json()
    if body["session_id"]:
        with client.stream("GET", f"/v1/analyze/{body['session_id']}/events") as s:
            for _ in s.iter_lines():
                pass


def test_report_flow_and_webhook(client):
    for i in range(8):
        analyze(client, "viral1", f"viewer-{i}")
    # Sinyal penonton ditulis berkelompok; setelah tersimpan, pemeriksaan berikutnya memicu peringatan.
    client.app.state.reports.flush()
    analyze(client, "viral1", "viewer-8")
    # Penyebaran cepat video hoaks TNI memicu peringatan otomatis sekali saja.
    assert ("tinggi", "Penyebaran terdeteksi") in client.sent or ("tinggi", "Deteksi otomatis") in client.sent
    assert sum(1 for level, _ in client.sent if level == "tinggi") == 1

    r = client.post("/v1/reports", headers={"X-Narasi-Install": "viewer-1"},
                    json={"platform": "testbed", "video_id": "viral1", "url": "http://localhost:8765/#v01",
                          "reason": "mencatut_tni", "note": "beredar di grup WA"})
    assert r.status_code == 201
    assert client.sent[-1][1] == "Laporan pengguna"

    assert client.get("/v1/reports").status_code == 401
    auth = {"X-Dashboard-Token": "rahasia"}
    reports = client.get("/v1/reports", headers=auth).json()
    assert reports[0]["label"] == "hoax" and reports[0]["tni_related"] and reports[0]["note"] == "beredar di grup WA"

    alerts = client.get("/v1/alerts", headers=auth).json()
    assert alerts[0]["video_key"] == "testbed:viral1" and alerts[0]["reports"] == 1 and alerts[0]["viewers_1h"] == 9

    r = client.patch(f"/v1/reports/{reports[0]['id']}", headers=auth, json={"status": "ditindaklanjuti", "note": "klarifikasi Pendam"})
    assert r.json()["status"] == "ditindaklanjuti"
    assert client.patch("/v1/reports/tidakada", headers=auth, json={"status": "ditutup"}).status_code == 404


def test_views_are_batched_and_summary_clusters_reuploads(tmp_path):
    store = ReportStore(str(tmp_path / "r.db"), "salt")
    for vid, claim in [("a", "TNI akan menyerang Aceh pada 1 November 2026"),
                       ("b", "TNI menyerang Aceh 1 November 2026, warga diminta mengungsi"),
                       ("c", "Anggota Kodim 0612/Tasikmalaya memukuli warga saat razia")]:
        r = result(vid)
        r.claims = [Claim(id=vid, text=claim, source="caption")]
        store.record_result(r)
    for i in range(300):
        store.record_view("tiktok", "x", "", f"u{i}")  # belum ada di disk
    assert store._db.execute("SELECT COUNT(*) FROM views").fetchone()[0] == 0
    assert store.flush() > 0
    assert store._db.execute("SELECT COUNT(*) FROM views").fetchone()[0] == 300

    for i in range(7):
        store.record_view("testbed", "a", "", f"v{i}")
    s = store.summary()
    claims = [n["claim"] for n in s["narratives"]]
    aceh = next(n for n in s["narratives"] if "Aceh" in (n["claim"] or ""))
    assert aceh["videos"] == 2 and len(claims) == 2  # dua unggahan Aceh menjadi satu narasi
    assert s["status"] == "siaga" and s["levels"]["tinggi"] >= 1
    store.close()


def test_report_notes_mask_personal_data(tmp_path):
    store = ReportStore(str(tmp_path / "r.db"), "salt")
    report = store.add_report(platform="testbed", video_id="x1", url="", reason="hoaks",
                              note="Hubungi saya di 0812-3456-7890 atau budi@mail.com, NIK 3201012345678901",
                              install_id="abc", client_result=None)
    assert report["note"] == "Hubungi saya di [nomor HP] atau [email], NIK [NIK]"
    assert store.update_report(report["id"], "ditinjau", "pelapor +62 813 1111 2222")["status_note"] == "pelapor [nomor HP]"
    store.close()


def test_closed_reports_expire_but_open_ones_stay(tmp_path):
    store = ReportStore(str(tmp_path / "r.db"), "salt", closed_retention_days=30)
    kwargs = dict(platform="testbed", url="", reason="hoaks", note="", install_id=None, client_result=None)
    closed = store.add_report(video_id="a", **kwargs)
    still_open = store.add_report(video_id="b", **kwargs)
    store.update_report(closed["id"], "ditutup", "")
    store.flush()
    assert store.get_report(closed["id"])  # belum lewat masa retensi
    store._purge(time.time() + 31 * 24 * 3600)
    assert store.get_report(closed["id"]) == {} and store.get_report(still_open["id"])
    store.close()
