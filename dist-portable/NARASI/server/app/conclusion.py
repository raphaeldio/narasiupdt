"""Kesimpulan bersitasi. Kalimat tanpa sitasi dibuang (mitigasi halusinasi, PRD Bagian 14)."""

import re

from .models import Claim, Evidence
from .scoring import Verdict
from .signals import Risk

_CITE = re.compile(r"\[(\d+)\]")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_CONFIDENCE = {"high": "tinggi", "medium": "sedang"}


def order_evidence(evidence: list[Evidence], top_claim_id: str | None) -> list[Evidence]:
    """Urutan tampilan di panel; nomor sitasi [n] mengacu ke urutan ini.

    Satu sumber yang cocok dengan beberapa klaim (mis. dari teks layar dan audio) cukup tampil sekali.
    """
    ordered, seen = [], set()
    for e in sorted(evidence, key=lambda e: (e.claim_id != top_claim_id, -e.weight)):
        if e.url not in seen:
            seen.add(e.url)
            ordered.append(e)
    return ordered


def keep_cited(text: str, n_sources: int) -> str:
    kept = []
    for sentence in _SENTENCE.split(text.strip()):
        cites = [int(c) for c in _CITE.findall(sentence)]
        if cites and all(1 <= c <= n_sources for c in cites):
            kept.append(sentence.strip())
    return " ".join(kept)


def local_conclusion(verdict: Verdict, claims: list[Claim], evidence: list[Evidence],
                     risk: Risk | None = None, ai: dict | None = None) -> str:
    factual = [c for c in claims if c.kind == "factual"]
    if verdict.label == "satire":
        return ("Konten ini terdeteksi sebagai satire atau parodi, sehingga tidak diberi skor hoaks. "
                "Tetap perhatikan konteksnya sebelum membagikan.")
    if verdict.basis == "signals" and risk:
        names = ", ".join(s["label"].lower() for s in risk.signals[:3])
        return (f"Belum ada cek fakta yang cocok, tetapi cara penulisannya punya ciri konten menyesatkan: {names}. "
                "Ini peringatan dari pola bahasa, bukan bukti bahwa isinya salah. Cek sumber resmi sebelum membagikan.")
    if verdict.basis == "ai" and ai:
        reason = str(ai.get("reason") or "").strip()
        lead = ("Belum ada cek fakta yang cocok. Penilaian AI: klaim ini kemungkinan keliru atau kehilangan konteks."
                if verdict.label == "caution" else
                "Belum ada cek fakta yang cocok. Penilaian AI: klaim ini sejalan dengan informasi yang umum diketahui.")
        return f"{lead} {reason} Penilaian AI bukan bukti; tunggu konfirmasi sumber resmi.".replace("  ", " ")
    if verdict.label == "neutral":
        return "Tidak ada klaim faktual yang perlu diperiksa di konten ini (isinya opini, hiburan, atau ajakan biasa)."
    if verdict.label in ("unverified", "error") or verdict.top_claim_id is None:
        if not factual:
            return "Tidak ditemukan klaim faktual yang dapat diperiksa di video ini (isi berupa opini atau ajakan)."
        return ("Belum ditemukan pemeriksaan fakta atau pemberitaan media terverifikasi yang cocok dengan klaim ini. "
                "Hasil ini tidak berarti video benar atau aman.")

    claim = next(c for c in claims if c.id == verdict.top_claim_id)
    cited = [(i + 1, e) for i, e in enumerate(evidence) if e.claim_id == claim.id and e.verdict is not None][:2]
    parts = " dan ".join(f"dinilai \"{e.rating}\" oleh {e.publisher} [{n}]" for n, e in cited)
    refs = "".join(f"[{n}]" for n, _ in cited)
    conf = _CONFIDENCE.get(verdict.confidence or "", "sedang")
    first = f"Klaim \"{claim.text}\" {parts}."
    if verdict.label == "hoax":
        return f"{first} Indeks indikasi hoaks {verdict.score}% dengan keyakinan {conf} {refs}."
    if verdict.label == "caution":
        return (f"{first} Sebagian isi klaim bermasalah atau kehilangan konteks, "
                f"periksa penjelasan lengkap di sumber {refs}.")
    return (f"{first} Klaim ini didukung sumber, tetapi tidak menjamin seluruh isi video benar {refs}.")
