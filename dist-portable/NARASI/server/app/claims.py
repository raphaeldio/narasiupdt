"""Ekstraksi klaim lokal (heuristik) — dipakai bila LLM tidak tersedia atau gagal.

Bahasa Indonesia dan Inggris memakai daftar kata kerja faktual; bahasa lain memakai sinyal umum
(angka, tanggal, panjang kalimat) karena daftar kata per bahasa tidak akan pernah lengkap.
"""

import re

from .lang import detect_language
from .models import Claim, Modality
from .text import MONTHS, claim_hash, extract_context, normalize, tokens
from .tni import is_tni_related
from .topics import GENERAL, primary

MAX_CLAIMS = 3

_SATIRE_MARKERS = {"satire", "satir", "parodi", "parody", "candaan", "bercanda", "fiksi", "becanda", "jokes",
                   "sketch", "skit", "meme", "prank"}
_OPINION_MARKERS = (
    "menurut saya", "menurutku", "menurut aku", "saya rasa", "aku rasa", "kayaknya", "sepertinya",
    "imo", "semoga", "keren", "mantap", "bangga", "salut", "lucu", "sedih", "kangen", "love",
    "terima kasih", "makasih", "jangan lupa", "follow", "like dan", "subscribe",
    "i think", "i feel", "in my opinion", "i love", "so cute", "so proud", "thank you", "cant wait", "hope",
    "follow me", "like and", "check out", "who else",
)
_FACT_VERBS = {
    "akan", "bakal", "telah", "sudah", "resmi", "dibuka", "ditutup", "ditangkap", "menyerang", "serang",
    "meninggal", "tewas", "terjadi", "mengumumkan", "melarang", "dilarang", "membagikan", "dibagikan",
    "menyatakan", "terlibat", "mengerahkan", "dikerahkan", "menembak", "ditembak", "memukul", "dipukul",
    "wajib", "gratis", "naik", "turun", "dibubarkan", "diserang", "mengungsi", "dievakuasi", "dicabut",
    "bantuan", "darurat", "perang", "kudeta", "rekrutmen", "pendaftaran", "lowongan", "menculik",
    "diculik", "membakar", "dibakar", "menangkap", "mengandung", "menyebabkan", "menyembuhkan",
    "memukuli", "menewaskan", "mencopot", "dicopot", "menetapkan", "ditetapkan", "memerintahkan", "menyita",
    "disita", "mengguncang", "menerjang", "melanda", "membagi", "dipungut", "membayar", "menaikkan",
    # Inggris
    "announced", "announces", "confirmed", "confirms", "banned", "bans", "arrested", "killed", "died", "dead",
    "attacked", "attacks", "invaded", "signed", "approved", "passed", "causes", "caused", "cures", "cured",
    "contains", "found", "discovered", "revealed", "reveals", "admitted", "admits", "seized", "raided",
    "leaked", "won", "lost", "fired", "resigned", "launched", "declared", "declares", "ordered", "shows",
    "proves", "linked", "recalled", "evacuated", "struck", "hit", "destroyed", "collapsed",
}
_SPLIT = re.compile(r"(?<=[.!?。！？])\s+|[。！？]|\n+|\s+[|•]\s+|\s+-\s+")
_HASHTAG = re.compile(r"#(\w+)")


def is_satire(text: str, hashtags: list[str] | None = None) -> bool:
    tags = {t.lower().lstrip("#") for t in (hashtags or [])} | {t.lower() for t in _HASHTAG.findall(text)}
    words = set(normalize(text).split())
    return bool((tags | words) & _SATIRE_MARKERS)


def _is_factual(sentence: str, language: str) -> bool:
    norm = normalize(sentence)
    toks = tokens(sentence)
    if len(toks) < 3:
        return False
    words = set(norm.split())
    ctx = extract_context(sentence)
    has_number = bool(ctx.dates or ctx.years or re.search(r"\d", norm))
    opinion = any(m in f" {norm} " for m in (f" {o} " for o in _OPINION_MARKERS))
    if language not in ("id", "en"):
        # Tanpa daftar kata per bahasa: pernyataan (bukan pertanyaan) yang cukup panjang atau memuat angka.
        return not sentence.rstrip().endswith(("?", "？", "؟")) and (has_number or len(toks) >= 5)
    signals = 0
    signals += has_number
    signals += bool(ctx.locations or ctx.units)
    signals += bool(words & _FACT_VERBS)
    tni = is_tni_related(sentence)
    signals += tni
    signals += bool(words & set(MONTHS))
    # Kata topik (kesehatan, bencana, …) ikut dihitung; TNI sudah dihitung di atas.
    signals += (not tni) and primary(sentence) != GENERAL
    return signals >= 2 or (signals >= 1 and not opinion)


def extract_claims(text: str, source: Modality, hashtags: list[str] | None = None) -> list[Claim]:
    if not text.strip():
        return []
    satire = is_satire(text, hashtags)
    clean = _HASHTAG.sub(" ", text)
    language = detect_language(clean)
    text_topic = primary(text)
    seen: set[str] = set()
    claims: list[Claim] = []
    for raw in _SPLIT.split(clean):
        sentence = (raw or "").strip(" .!?:;,-\"'“”")
        if len(sentence) < (8 if language in ("zh", "ja", "ko", "th") else 15) or not _is_factual(sentence, language):
            continue
        cid = claim_hash(sentence)
        if cid in seen:
            continue
        seen.add(cid)
        topic = primary(sentence)
        claims.append(Claim(
            id=cid,
            text=sentence[:300],
            source=source,
            kind="satire" if satire else "factual",
            tni_related=is_tni_related(sentence),
            topic=topic if topic != GENERAL else text_topic,
            language=language,
        ))
    # Klaim terkait TNI diprioritaskan (FR13), lalu yang paling informatif.
    claims.sort(key=lambda c: (not c.tni_related, -len(tokens(c.text))))
    return claims[:MAX_CLAIMS]
