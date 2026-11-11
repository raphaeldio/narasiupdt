"""Indeks Indikasi Hoaks (PRD Bagian 8).

w(e) = kecocokan(e) × kredibilitas(e)
skor klaim = Σ(w × v) / Σw × 100, hanya untuk klaim dengan Σw ≥ 0,6
indeks video = skor tertinggi di antara klaim yang memenuhi syarat
keyakinan: tinggi bila Σw ≥ 1,5, sedang bila 0,6 ≤ Σw < 1,5

Bila tidak ada klaim yang memenuhi syarat bukti, label tidak langsung "belum terverifikasi":
1. tidak ada klaim faktual sama sekali          → "neutral" (tidak ada yang perlu diperiksa)
2. pola bahasa berisiko (signals.RISK_CAUTION)  → "caution", dasar "signals"
3. penilaian AI (bila tersedia)                 → "caution"/"supported", dasar "ai", keyakinan rendah
4. selain itu                                   → "unverified"
Label "hoax" hanya bisa lahir dari bukti.
"""

from dataclasses import dataclass
from typing import Literal

from .matching import MATCH_MIN
from .models import Basis, Claim, Evidence, Label
from .signals import RISK_CAUTION, Risk

WEIGHT_MIN = 0.6
HIGH_CONFIDENCE = 1.5


@dataclass
class ClaimScore:
    claim_id: str
    score: float | None
    total_weight: float


@dataclass
class Verdict:
    score: int | None
    label: Label
    confidence: Literal["high", "medium", "low"] | None
    top_claim_id: str | None
    basis: Basis = "none"


def score_claim(claim_id: str, evidence: list[Evidence]) -> ClaimScore:
    counted = [e for e in evidence if e.claim_id == claim_id and e.verdict is not None and e.match >= MATCH_MIN]
    total = sum(e.weight for e in counted)
    if total < WEIGHT_MIN:
        return ClaimScore(claim_id, None, total)
    return ClaimScore(claim_id, sum(e.weight * e.verdict for e in counted) / total * 100, total)


# Penilaian AI hanya dipakai bila cukup yakin; di bawah ini label tetap "belum terverifikasi".
AI_MIN_CONFIDENCE = 0.7


def aggregate(claims: list[Claim], evidence: list[Evidence], risk: Risk | None = None,
              ai: dict | None = None) -> Verdict:
    factual = [c for c in claims if c.kind == "factual"]
    scored = [s for s in (score_claim(c.id, evidence) for c in factual) if s.score is not None]

    if not scored:
        satire = any(c.kind == "satire" for c in claims) or any(
            e.verdict is None and e.match >= MATCH_MIN for e in evidence
        )
        if satire:
            return Verdict(None, "satire", None, None)
        risky = risk is not None and risk.score >= RISK_CAUTION
        if risky:
            return Verdict(None, "caution", "low", None, "signals")
        if not factual:
            return Verdict(None, "neutral", None, None)
        if ai and float(ai.get("confidence") or 0) >= AI_MIN_CONFIDENCE:
            if ai.get("verdict") in ("likely_false", "misleading"):
                return Verdict(None, "caution", "low", None, "ai")
            if ai.get("verdict") == "likely_true":
                return Verdict(None, "supported", "low", None, "ai")
        return Verdict(None, "unverified", None, None)

    top = max(scored, key=lambda s: (s.score, s.total_weight))
    score = round(top.score)
    if score >= 70:
        label: Label = "hoax"
    elif score >= 40:
        label = "caution"
    else:
        label = "supported"
    confidence = "high" if top.total_weight >= HIGH_CONFIDENCE else "medium"
    return Verdict(score, label, confidence, top.claim_id, "evidence")
