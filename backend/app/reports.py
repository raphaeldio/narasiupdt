"""Laporan ke TNI AD dan peringatan dini (PRD FR18).

Dua sumber sinyal, keduanya tanpa identitas penonton:
1. Laporan eksplisit dari pengguna (tombol "Laporkan ke TNI AD" di panel).
2. Kecepatan penyebaran: berapa penonton unik (hash ID instalasi acak) yang memeriksa video
   terkait TNI dalam satu jam terakhir dibanding jam sebelumnya. Video yang mulai naik cepat
   muncul di antrean sebelum benar-benar viral.

Data disimpan di SQLite agar laporan tidak hilang saat server dimulai ulang.

Skala: sinyal penonton tidak ditulis per permintaan. Semuanya dikumpulkan di memori lalu ditulis
sekaligus (satu transaksi) setiap beberapa detik, dan hasil query peringatan di-cache sebentar,
sehingga beban database tidak naik sebanding dengan jumlah pengguna atau petugas yang membuka dashboard.
"""

import hashlib
import json
import logging
import math
import re
import sqlite3
import threading
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any

from .advisor import ACTIONS, baseline, recommend
from .models import AnalysisResult
from .text import claim_hash, lexical_similarity
from .topics import GENERAL, TOPIC_LABELS

log = logging.getLogger("narasi.reports")

REPORT_STATUSES = ("baru", "ditinjau", "ditindaklanjuti", "ditutup")
LABEL_WEIGHT = {"hoax": 3.0, "caution": 2.0, "unverified": 1.0, "error": 1.0, "supported": 0.0, "satire": 0.0,
                "neutral": 0.0}
HOUR = 3600
FLUSH_MAX_PENDING = 500
ALERTS_CACHE_SECONDS = 5.0
NARRATIVE_SIMILARITY = 0.55
LEVEL_RANK = {"rendah": 0, "sedang": 1, "tinggi": 2}
LABEL_RANK = {"hoax": 3, "caution": 2, "unverified": 1, "error": 1, "satire": 0, "supported": 0, "neutral": 0}

# Catatan laporan berupa teks bebas: data pribadi yang terlanjur diketik pelapor disamarkan sebelum disimpan.
PII_PATTERNS = (
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email]"),
    (re.compile(r"(?<!\d)\d{16}(?!\d)"), "[NIK]"),
    (re.compile(r"(?<![\w+])(?:\+62|62|0)[\s-]?8(?:[\s-]?\d){7,11}(?!\d)"), "[nomor HP]"),
)


def redact_pii(text: str) -> str:
    for pattern, placeholder in PII_PATTERNS:
        text = pattern.sub(placeholder, text)
    return text

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    video_key TEXT PRIMARY KEY, platform TEXT, video_id TEXT, url TEXT, label TEXT, score INTEGER,
    tni_related INTEGER, claim TEXT, result_json TEXT, first_seen REAL, last_seen REAL
);
CREATE TABLE IF NOT EXISTS views (video_key TEXT, viewer TEXT, ts REAL, PRIMARY KEY (video_key, viewer));
CREATE INDEX IF NOT EXISTS views_ts ON views (ts);
CREATE INDEX IF NOT EXISTS views_video_ts ON views (video_key, ts);
CREATE INDEX IF NOT EXISTS videos_last_seen ON videos (last_seen);
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY, created REAL, video_key TEXT, platform TEXT, video_id TEXT, url TEXT,
    reason TEXT, note TEXT, reporter TEXT, label TEXT, score INTEGER, tni_related INTEGER,
    claims_json TEXT, evidence_json TEXT, status TEXT, status_note TEXT, updated REAL
);
CREATE INDEX IF NOT EXISTS reports_video ON reports (video_key);
CREATE INDEX IF NOT EXISTS reports_status ON reports (status, created);
CREATE TABLE IF NOT EXISTS notified (video_key TEXT, level TEXT, ts REAL, PRIMARY KEY (video_key, level));
CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY, ts REAL, narrative TEXT, action TEXT, note TEXT
);
CREATE INDEX IF NOT EXISTS actions_narrative ON actions (narrative);
"""
# Kolom yang ditambahkan setelah rilis pertama; basis data lama dimigrasi saat dibuka.
VIDEO_COLUMNS = {"topic": "TEXT", "language": "TEXT", "basis": "TEXT", "risk": "INTEGER"}


def alert_level(priority: float, reports: int) -> str:
    if priority >= 8 or reports >= 3:
        return "tinggi"
    if priority >= 4 or reports >= 1:
        return "sedang"
    return "rendah"


def priority_of(label: str, tni_related: bool, viewers_1h: int, reports: int) -> float:
    weight = LABEL_WEIGHT.get(label, 1.0) if tni_related else LABEL_WEIGHT.get(label, 1.0) * 0.5
    return round(weight * (1 + math.log2(1 + viewers_1h)) + 2 * reports, 2)


class ReportStore:
    def __init__(self, path: str, salt: str, closed_retention_days: int = 90):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        # WAL: pembaca (dashboard) tidak memblokir penulis (pemeriksaan video) dan sebaliknya.
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA synchronous=NORMAL")
        self._db.executescript(SCHEMA)
        have = {r["name"] for r in self._db.execute("PRAGMA table_info(videos)")}
        for column, kind in VIDEO_COLUMNS.items():
            if column not in have:
                self._db.execute(f"ALTER TABLE videos ADD COLUMN {column} {kind}")
        self._lock = threading.Lock()
        self._salt = salt
        self._closed_retention = closed_retention_days * 24 * HOUR
        self._pending_videos: dict[str, tuple[str, str, str, float]] = {}
        self._pending_views: dict[tuple[str, str], float] = {}
        self._alerts_cache: dict[tuple, tuple[float, list[dict[str, Any]]]] = {}
        self._last_purge = 0.0
        self._last_flush = 0.0
        # Naik setiap kali data yang memengaruhi peringatan berubah (flush, laporan, hasil analisis).
        self.version = 0

    def _alerts_changed(self) -> None:
        self._alerts_cache.clear()
        self.version += 1

    def close(self) -> None:
        self.flush()
        self._db.close()

    def flush(self) -> int:
        """Tulis semua sinyal penonton yang tertunda dalam satu transaksi. Mengembalikan jumlah baris."""
        with self._lock:
            self._last_flush = time.monotonic()
            videos, self._pending_videos = self._pending_videos, {}
            views, self._pending_views = self._pending_views, {}
            now = time.time()
            if now - self._last_purge > HOUR:
                self._purge(now)
            if not videos and not views:
                return 0
            with self._db:
                self._db.executemany(
                    "INSERT INTO videos (video_key, platform, video_id, url, first_seen, last_seen) VALUES (?,?,?,?,?,?) "
                    "ON CONFLICT(video_key) DO UPDATE SET last_seen=MAX(last_seen, excluded.last_seen), "
                    "url=COALESCE(NULLIF(excluded.url,''), url)",
                    [(k, p, v, u, ts, ts) for k, (p, v, u, ts) in videos.items()],
                )
                self._db.executemany(
                    "INSERT OR REPLACE INTO views (video_key, viewer, ts) VALUES (?,?,?)",
                    [(k, viewer, ts) for (k, viewer), ts in views.items()],
                )
            self._alerts_changed()
            return len(videos) + len(views)

    def _purge(self, now: float) -> None:
        """Retensi: sinyal penonton 7 hari, laporan yang sudah ditutup sesuai closed_retention_days."""
        with self._db:
            self._db.execute("DELETE FROM views WHERE ts < ?", (now - 7 * 24 * HOUR,))
            if self._closed_retention > 0:
                self._db.execute("DELETE FROM reports WHERE status='ditutup' AND updated < ?",
                                 (now - self._closed_retention,))
        self._last_purge = now
        self._alerts_changed()

    def viewer_hash(self, install_id: str | None) -> str | None:
        if not install_id:
            return None
        return hashlib.sha256(f"{self._salt}:{install_id}".encode()).hexdigest()[:16]

    # ------------------------------------------------------------------ sinyal penonton

    def record_view(self, platform: str, video_id: str, url: str, install_id: str | None) -> None:
        """Hanya menulis ke memori (O(1)); disimpan ke disk oleh flush() berkala."""
        key = f"{platform}:{video_id}"
        now = time.time()
        viewer = self.viewer_hash(install_id)
        with self._lock:
            prev = self._pending_videos.get(key)
            self._pending_videos[key] = (platform, video_id, url or (prev[2] if prev else ""), now)
            if viewer:
                self._pending_views[(key, viewer)] = now
            should_flush = len(self._pending_views) >= FLUSH_MAX_PENDING
        if should_flush:
            self.flush()

    def record_result(self, result: AnalysisResult) -> None:
        key = f"{result.platform}:{result.video_id}"
        claim = next((c.text for c in result.claims if c.kind == "factual"), None)
        now = time.time()
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO videos (video_key, platform, video_id, url, label, score, tni_related, claim, result_json, "
                "first_seen, last_seen, topic, language, basis, risk) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(video_key) DO UPDATE SET "
                "label=excluded.label, score=excluded.score, tni_related=excluded.tni_related, claim=excluded.claim, "
                "result_json=excluded.result_json, last_seen=excluded.last_seen, topic=excluded.topic, "
                "language=excluded.language, basis=excluded.basis, risk=excluded.risk",
                (key, result.platform, result.video_id, "", result.label, result.score, int(result.tni_related), claim,
                 result.model_dump_json(), now, now, (result.topics or [GENERAL])[0], result.language, result.basis,
                 int((result.risk or {}).get("score", 0))),
            )
            self._alerts_changed()

    # ------------------------------------------------------------------ laporan

    def add_report(self, *, platform: str, video_id: str, url: str, reason: str, note: str,
                   install_id: str | None, client_result: AnalysisResult | None) -> dict[str, Any]:
        key = f"{platform}:{video_id}"
        with self._lock:
            row = self._db.execute("SELECT result_json FROM videos WHERE video_key=?", (key,)).fetchone()
        # Hasil yang dihitung server lebih dipercaya daripada salinan dari klien.
        result = AnalysisResult.model_validate_json(row["result_json"]) if row and row["result_json"] else client_result
        report_id = uuid.uuid4().hex[:12]
        now = time.time()
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO reports VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (report_id, now, key, platform, video_id, url, reason, redact_pii(note[:500]), self.viewer_hash(install_id),
                 result.label if result else None, result.score if result else None,
                 int(result.tni_related) if result else 0,
                 json.dumps([c.model_dump() for c in result.claims]) if result else "[]",
                 json.dumps([e.model_dump() for e in result.evidence]) if result else "[]",
                 "baru", "", now),
            )
            self._db.execute(
                "INSERT INTO videos (video_key, platform, video_id, url, first_seen, last_seen) VALUES (?,?,?,?,?,?) "
                "ON CONFLICT(video_key) DO UPDATE SET url=COALESCE(NULLIF(excluded.url,''), url)",
                (key, platform, video_id, url, now, now),
            )
        return self.get_report(report_id)

    def get_report(self, report_id: str) -> dict[str, Any]:
        with self._lock:
            row = self._db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
        return self._report_dict(row) if row else {}

    def list_reports(self, status: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        sql = "SELECT * FROM reports"
        args: tuple = ()
        if status:
            sql += " WHERE status=?"
            args = (status,)
        sql += " ORDER BY created DESC LIMIT ?"
        with self._lock:
            rows = self._db.execute(sql, (*args, limit)).fetchall()
        return [self._report_dict(r) for r in rows]

    def update_report(self, report_id: str, status: str, note: str) -> dict[str, Any]:
        with self._lock, self._db:
            self._db.execute(
                "UPDATE reports SET status=?, status_note=?, updated=? WHERE id=?",
                (status, redact_pii(note[:500]), time.time(), report_id),
            )
            self._alerts_changed()
        return self.get_report(report_id)

    def report_counts(self) -> dict[str, dict[str, int]]:
        with self._lock:
            by_status = self._db.execute("SELECT status, COUNT(*) n FROM reports GROUP BY status").fetchall()
            by_reason = self._db.execute(
                "SELECT reason, COUNT(*) n FROM reports WHERE status IN ('baru','ditinjau') GROUP BY reason"
            ).fetchall()
        return {"by_status": {r["status"]: r["n"] for r in by_status},
                "open_by_reason": {r["reason"]: r["n"] for r in by_reason}}

    @staticmethod
    def _report_dict(row: sqlite3.Row) -> dict[str, Any]:
        d = dict(row)
        d.pop("reporter", None)  # hash pelapor hanya untuk deduplikasi, tidak ditampilkan
        d["tni_related"] = bool(d["tni_related"])
        d["claims"] = json.loads(d.pop("claims_json") or "[]")
        d["evidence"] = json.loads(d.pop("evidence_json") or "[]")
        return d

    # ------------------------------------------------------------------ peringatan dini

    def alerts(self, hours: int = 24, limit: int = 50, include_non_tni: bool = True,
               video_key: str | None = None) -> list[dict[str, Any]]:
        """Antrean semua isu. Isu non-TNI ikut masuk dengan bobot prioritas separuh (lihat priority_of)."""
        cache_key = (hours, limit, include_non_tni, video_key)
        cached = self._alerts_cache.get(cache_key) if video_key is None else None
        if cached and time.monotonic() - cached[0] < ALERTS_CACHE_SECONDS:
            return cached[1]
        # Jalur per video (dipanggil saat pemeriksaan) paling sering flush sekali per detik.
        if video_key is None or time.monotonic() - self._last_flush > 1.0:
            self.flush()
        now = time.time()
        since = now - hours * HOUR
        only_v = " AND v.video_key = ?" if video_key else ""
        only_w = " AND video_key = ?" if video_key else ""
        extra = (video_key,) if video_key else ()
        with self._lock:
            rows = self._db.execute(
                f"""
                WITH w AS (
                  SELECT video_key,
                    SUM(ts >= :h1) AS viewers_1h,
                    SUM(ts >= :h2 AND ts < :h1) AS viewers_prev_1h,
                    COUNT(*) AS viewers_window
                  FROM views WHERE ts >= :since{only_w.replace('?', ':vk')} GROUP BY video_key
                ), r AS (
                  SELECT video_key,
                    COUNT(DISTINCT COALESCE(reporter, id)) AS reports,
                    SUM(status IN ('baru','ditinjau')) AS open_reports
                  FROM reports GROUP BY video_key
                )
                SELECT v.*, COALESCE(w.viewers_1h, 0) AS viewers_1h, COALESCE(w.viewers_prev_1h, 0) AS viewers_prev_1h,
                  COALESCE(w.viewers_window, 0) AS viewers_window, COALESCE(r.reports, 0) AS reports,
                  COALESCE(r.open_reports, 0) AS open_reports
                FROM videos v LEFT JOIN w ON w.video_key = v.video_key LEFT JOIN r ON r.video_key = v.video_key
                WHERE v.last_seen >= :since AND (v.tni_related = 1 OR r.reports > 0 OR :non_tni){only_v.replace('?', ':vk')}
                """,
                {"h1": now - HOUR, "h2": now - 2 * HOUR, "since": since, "non_tni": int(include_non_tni),
                 **({"vk": video_key} if video_key else {})},
            ).fetchall()
        alerts = []
        for r in rows:
            tni = bool(r["tni_related"])
            label = r["label"] or "unverified"
            reports = r["reports"]
            # Antrean: konten bermasalah (semua topik bila include_non_tni), atau yang dilaporkan pengguna.
            if not (reports or ((tni or include_non_tni) and label in ("hoax", "caution"))):
                continue
            priority = priority_of(label, tni, r["viewers_1h"], reports)
            rising = r["viewers_1h"] >= 3 and r["viewers_1h"] >= 2 * max(1, r["viewers_prev_1h"])
            alerts.append({
                "video_key": r["video_key"], "platform": r["platform"], "video_id": r["video_id"], "url": r["url"],
                "label": label, "score": r["score"], "tni_related": tni, "claim": r["claim"],
                "topic": r["topic"] or GENERAL, "language": r["language"] or "id", "basis": r["basis"] or "evidence",
                "risk": r["risk"] or 0,
                "viewers_1h": r["viewers_1h"], "viewers_prev_1h": r["viewers_prev_1h"],
                "viewers_window": r["viewers_window"], "reports": reports, "open_reports": r["open_reports"],
                "rising": rising, "priority": priority, "level": alert_level(priority, reports),
                "first_seen": r["first_seen"], "last_seen": r["last_seen"],
            })
        alerts.sort(key=lambda a: (a["level"] == "tinggi", a["rising"], a["priority"]), reverse=True)
        alerts = alerts[:limit]
        if video_key is None:
            self._alerts_cache[cache_key] = (time.monotonic(), alerts)
        return alerts

    # ------------------------------------------------------------------ aksi petugas

    def add_action(self, narrative: str, action: str, note: str = "") -> dict[str, Any]:
        row = {"id": uuid.uuid4().hex[:12], "ts": time.time(), "narrative": narrative, "action": action,
               "note": redact_pii(note[:300])}
        with self._lock, self._db:
            self._db.execute("INSERT INTO actions VALUES (:id,:ts,:narrative,:action,:note)", row)
        return row

    def actions_taken(self, limit: int = 500) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM actions ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

    def summary(self, hours: int = 24) -> dict[str, Any]:
        """Ringkasan untuk petugas: video dengan klaim serupa digabung menjadi satu narasi."""
        alerts = self.alerts(hours=hours, limit=2000)
        narratives = cluster_narratives(alerts)
        taken = self.actions_taken()
        done: dict[str, set[str]] = defaultdict(set)
        for a in taken:
            done[a["narrative"]].add(a["action"])
        for n in narratives:
            n["actions"] = recommend(n, done.get(n["key"]))
            n["sim"] = baseline(n["viewers_1h"], n["viewers_prev_1h"], n["viewers_window"])
        by_topic: dict[str, dict[str, Any]] = {}
        for n in narratives:
            t = by_topic.setdefault(n["topic"], {"topic": n["topic"], "label": TOPIC_LABELS.get(n["topic"], n["topic"]),
                                                 "narratives": 0, "videos": 0, "viewers_1h": 0, "tinggi": 0})
            t["narratives"] += 1
            t["videos"] += n["videos"]
            t["viewers_1h"] += n["viewers_1h"]
            t["tinggi"] += n["level"] == "tinggi"
        levels = {lvl: sum(1 for n in narratives if n["level"] == lvl) for lvl in ("tinggi", "sedang", "rendah")}
        rising = sum(1 for n in narratives if n["rising"])
        counts = self.report_counts()
        open_reports = counts["by_status"].get("baru", 0) + counts["by_status"].get("ditinjau", 0)

        if levels["tinggi"]:
            status, headline = "siaga", (f"{levels['tinggi']} narasi berprioritas tinggi perlu klarifikasi"
                                         + (f", {rising} sedang naik cepat" if rising else ""))
        elif levels["sedang"] or open_reports:
            status, headline = "waspada", f"{levels['sedang']} narasi perlu dipantau, {open_reports} laporan terbuka"
        else:
            status, headline = "normal", "Belum ada narasi yang perlu ditindaklanjuti"

        with self._lock:
            latest = self._db.execute(
                "SELECT id, created, platform, reason, note, label, score, claims_json FROM reports "
                "WHERE status IN ('baru','ditinjau') ORDER BY created DESC LIMIT 5"
            ).fetchall()
        return {
            "status": status,
            "headline": headline,
            "levels": levels,
            "rising": rising,
            "videos_flagged": len(alerts),
            "narratives": narratives[:12],
            "narratives_total": len(narratives),
            "tni_narratives": sum(1 for n in narratives if n["tni_related"]),
            "topics": sorted(by_topic.values(), key=lambda t: (t["tinggi"], t["viewers_1h"], t["narratives"]),
                             reverse=True),
            "action_catalog": ACTIONS,
            "actions_taken": taken[:20],
            "reports": {**counts, "open": open_reports, "latest_open": [
                {"id": r["id"], "created": r["created"], "platform": r["platform"], "reason": r["reason"],
                 "note": r["note"], "label": r["label"], "score": r["score"],
                 "claim": next((c["text"] for c in json.loads(r["claims_json"] or "[]")), None)}
                for r in latest
            ]},
        }

    def alert_for(self, video_key: str) -> dict[str, Any] | None:
        found = self.alerts(hours=24 * 7, video_key=video_key)
        return found[0] if found else None

    def mark_notified(self, video_key: str, level: str) -> bool:
        """True bila level ini belum pernah dikirim untuk video tersebut."""
        with self._lock, self._db:
            cur = self._db.execute(
                "INSERT OR IGNORE INTO notified (video_key, level, ts) VALUES (?,?,?)", (video_key, level, time.time())
            )
        return cur.rowcount == 1


def cluster_narratives(alerts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Gabungkan video dengan klaim serupa (unggahan ulang di platform lain, potongan berbeda).

    Greedy: video diurutkan dari prioritas tertinggi; tiap video masuk ke narasi pertama yang
    klaim wakilnya mirip (leksikal) atau membuat narasi baru. Video tanpa klaim berdiri sendiri.
    """
    clusters: list[dict[str, Any]] = []
    for a in sorted(alerts, key=lambda x: x["priority"], reverse=True):
        home = None
        if a["claim"]:
            home = next((c for c in clusters if c["claim"]
                         and lexical_similarity(a["claim"], c["claim"]) >= NARRATIVE_SIMILARITY), None)
        if home is None:
            home = {"claim": a["claim"], "members": []}
            clusters.append(home)
        home["members"].append(a)

    out = []
    for c in clusters:
        m = c["members"]
        platforms: dict[str, int] = defaultdict(int)
        topics: dict[str, int] = defaultdict(int)
        for a in m:
            platforms[a["platform"]] += 1
            topics[a.get("topic") or GENERAL] += 1
        worst = max(m, key=lambda a: (LABEL_RANK.get(a["label"], 0), a["score"] or 0))
        out.append({
            # Kunci stabil untuk mencatat aksi petugas: hash klaim, atau video bila klaim belum terdeteksi.
            "key": claim_hash(c["claim"]) if c["claim"] else claim_hash(m[0]["video_key"]),
            "topic": max(topics, key=lambda t: (t != GENERAL, topics[t])),
            "basis": worst.get("basis") or "evidence",
            "language": worst.get("language") or "id",
            "viewers_window": sum(a["viewers_window"] for a in m),
            "claim": c["claim"],
            "level": max((a["level"] for a in m), key=LEVEL_RANK.__getitem__),
            "rising": any(a["rising"] for a in m),
            "tni_related": any(a["tni_related"] for a in m),
            "label": worst["label"],
            "score": worst["score"],
            "videos": len(m),
            "platforms": dict(platforms),
            "viewers_1h": sum(a["viewers_1h"] for a in m),
            "viewers_prev_1h": sum(a["viewers_prev_1h"] for a in m),
            "reports": sum(a["reports"] for a in m),
            "open_reports": sum(a["open_reports"] for a in m),
            "priority": round(max(a["priority"] for a in m) + 0.5 * (len(m) - 1), 2),
            "first_seen": min(a["first_seen"] for a in m),
            "last_seen": max(a["last_seen"] for a in m),
            "top_videos": [
                {"platform": a["platform"], "video_id": a["video_id"], "url": a["url"], "viewers_1h": a["viewers_1h"],
                 "reports": a["reports"]}
                for a in sorted(m, key=lambda a: a["viewers_1h"], reverse=True)[:3]
            ],
        })
    out.sort(key=lambda n: (LEVEL_RANK[n["level"]], n["rising"], n["priority"]), reverse=True)
    return out
