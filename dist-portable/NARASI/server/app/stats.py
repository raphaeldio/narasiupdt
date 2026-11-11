"""Agregat anonim untuk Mode Satuan (PRD FR14). Tidak menyimpan identitas penonton."""

import time
from collections import Counter, deque
from dataclasses import dataclass

from .models import AnalysisResult


@dataclass
class Record:
    ts: float
    platform: str
    video_key: str
    label: str
    score: int | None
    tni_related: bool
    claim: str | None
    cache_hit: bool
    topic: str = "umum"
    language: str = "id"
    basis: str = "none"


class Stats:
    def __init__(self, max_records: int = 20000):
        self._records: deque[Record] = deque(maxlen=max_records)
        self._feedback: deque[dict] = deque(maxlen=2000)

    def record(self, result: AnalysisResult, cache_hit: bool) -> None:
        top = next((c.text for c in result.claims if c.kind == "factual"), None)
        self._records.append(Record(
            ts=time.time(), platform=result.platform, video_key=f"{result.platform}:{result.video_id}",
            label=result.label, score=result.score, tni_related=result.tni_related, claim=top,
            cache_hit=cache_hit, topic=(result.topics or ["umum"])[0], language=result.language,
            basis=result.basis,
        ))

    def feedback(self, platform: str, video_id: str, claim_id: str | None, reason: str) -> None:
        # Masuk antrean tinjauan; tidak mengubah label publik (FR15).
        self._feedback.append({"ts": time.time(), "platform": platform, "video_id": video_id,
                               "claim_id": claim_id, "reason": reason})

    def summary(self, hours: int = 24) -> dict:
        now = time.time()
        recent = [r for r in self._records if r.ts >= now - hours * 3600]
        tni = [r for r in recent if r.tni_related]

        by_hour: dict[int, Counter] = {}
        for r in recent:
            # Slot terakhir (hours-1) adalah jam berjalan; ts == now tidak boleh jatuh ke slot ke-(hours).
            bucket = min(hours - 1, int((r.ts - (now - hours * 3600)) // 3600))
            by_hour.setdefault(bucket, Counter())[r.label] += 1
        timeline = [
            {"hours_ago": hours - b - 1, **{k: by_hour.get(b, Counter()).get(k, 0)
                                            for k in ("hoax", "caution", "supported", "unverified", "satire",
                                                      "neutral")}}
            for b in range(hours)
        ]

        videos: dict[str, dict] = {}
        for r in recent:
            v = videos.setdefault(r.video_key, {"video": r.video_key, "platform": r.platform, "checks": 0,
                                                "label": r.label, "score": r.score, "claim": r.claim,
                                                "tni_related": r.tni_related})
            v["checks"] += 1
        top_videos = sorted(videos.values(), key=lambda v: v["checks"], reverse=True)[:10]

        tni_claims = Counter(r.claim for r in tni if r.claim and r.label in ("hoax", "caution"))
        flagged = [r for r in recent if r.label in ("hoax", "caution")]
        by_topic: dict[str, Counter] = {}
        for r in recent:
            by_topic.setdefault(r.topic, Counter())[r.label] += 1
        identified = sum(r.label != "unverified" and r.label != "error" for r in recent)
        return {
            "window_hours": hours,
            "total_checks": len(recent),
            "cache_hit_rate": round(sum(r.cache_hit for r in recent) / len(recent), 3) if recent else 0.0,
            "labels": dict(Counter(r.label for r in recent)),
            # Seberapa sering hasilnya bukan "belum terverifikasi" (target: tidak melulu tidak teridentifikasi).
            "identified_rate": round(identified / len(recent), 3) if recent else 0.0,
            "basis": dict(Counter(r.basis for r in recent)),
            "languages": dict(Counter(r.language for r in recent)),
            "foreign_checks": sum(r.language != "id" for r in recent),
            "topics": [
                {"topic": t, "total": sum(c.values()), "flagged": c.get("hoax", 0) + c.get("caution", 0),
                 "labels": dict(c)}
                for t, c in sorted(by_topic.items(), key=lambda kv: sum(kv[1].values()), reverse=True)
            ],
            "top_claims": [{"claim": c, "count": n} for c, n in
                           Counter(r.claim for r in flagged if r.claim).most_common(10)],
            "platforms": dict(Counter(r.platform for r in recent)),
            "tni_checks": len(tni),
            "tni_hoax_or_caution": sum(r.label in ("hoax", "caution") for r in tni),
            "top_tni_claims": [{"claim": c, "count": n} for c, n in tni_claims.most_common(10)],
            "top_videos": top_videos,
            "timeline": timeline,
            "feedback_pending": len(self._feedback),
        }
