"""Pencocokan konteks klaim vs bukti (PRD FR07)."""

from .text import dice, extract_context, lexical_similarity

MATCH_MIN = 0.6


def context_match(claim: str, reviewed: str, semantic: float | None = None) -> float:
    """Skor kecocokan 0..1.

    Mulai dari kemiripan semantik (embedding bila ada, leksikal bila tidak), lalu disesuaikan
    dengan apa/kapan/di mana: bukti dengan kata kerja, tanggal, lokasi, atau satuan yang
    berbeda dianggap peristiwa lain walaupun kata-katanya mirip.
    """
    s = lexical_similarity(claim, reviewed)
    if semantic is not None:
        s = max(s, semantic)

    a, b = extract_context(claim), extract_context(reviewed)

    # Tidak ada satu pun kata "apa" yang sama (mis. "bakti sosial" vs "serang"): peristiwa lain.
    # Embedding menilai keduanya mirip karena pelaku, tempat, dan tanggalnya sama, jadi ini veto, bukan penalti.
    content_conflict = bool(a.content and b.content and not a.content & b.content)
    if a.content and b.content and not content_conflict:
        s += 0.05
    if a.dates and b.dates:
        s += 0.1 if a.dates & b.dates else -0.35
    elif a.years and b.years and not a.years & b.years:
        s -= 0.3
    if a.locations and b.locations:
        s += 0.05 if a.locations & b.locations else -0.3
    if a.units and b.units:
        s += 0.05 if a.units & b.units else -0.3
    if content_conflict:
        s = min(s - 0.4, MATCH_MIN - 0.1)

    return round(min(1.0, max(0.0, s)), 3)


def content_overlap(claim: str, reviewed: str) -> float:
    return dice(extract_context(claim).content, extract_context(reviewed).content)
