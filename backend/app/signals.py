"""Sinyal risiko dari pola bahasa: pendekatan kedua selain pencocokan cek fakta.

Banyak hoaks baru belum pernah diperiksa siapa pun, jadi pencarian bukti pulang kosong. Pola
penulisannya tetap bisa dikenali: desakan menyebarkan, bahasa sensasional, sumber anonim, klaim
mutlak, ajakan klik/transfer, dan provokasi. Sinyal ini TIDAK membuktikan sebuah klaim salah;
ia hanya menaikkan label dari "belum terverifikasi" menjadi "perlu diwaspadai" dan selalu
ditampilkan terpisah dari bukti.
"""

import re
from dataclasses import dataclass

from .text import normalize

RISK_CAUTION = 45  # ambang label "perlu diwaspadai" tanpa bukti


@dataclass(frozen=True)
class Signal:
    id: str
    label: str
    weight: int
    terms: tuple[str, ...]


SIGNALS: tuple[Signal, ...] = (
    Signal("urgensi", "Mendesak agar cepat disebarkan", 30, (
        "sebarkan", "viralkan", "sebar luaskan", "sebelum dihapus", "sebelum di hapus", "bagikan ke semua",
        "jangan berhenti di kamu", "teruskan ke", "share sebelum", "wajib share", "bantu share", "bantu viralkan",
        "share before", "before it gets deleted", "before its deleted", "before they delete", "spread the word",
        "share this with everyone", "repost before", "must share",
    )),
    Signal("sensasional", "Bahasa sensasional", 15, (
        "terbongkar", "terungkap", "mengejutkan", "menggemparkan", "gempar", "heboh", "geger", "mencengangkan",
        "ternyata selama ini", "breaking", "astaga", "tak disangka", "shocking", "exposed", "bombshell",
        "you wont believe", "jaw dropping", "unbelievable",
    )),
    Signal("konspirasi", "Narasi konspirasi", 25, (
        "elit global", "media menutupi", "media bungkam", "disembunyikan pemerintah", "ditutup tutupi",
        "tidak diberitakan media", "settingan", "rekayasa", "antek asing", "agenda tersembunyi", "dalang di balik",
        "they dont want you to know", "cover up", "mainstream media wont", "deep state", "false flag",
        "what theyre hiding", "wake up people",
    )),
    Signal("sumber_anonim", "Sumber tidak jelas", 20, (
        "katanya", "kabarnya", "konon", "info dari orang dalam", "orang dalam", "dapat info", "dapat kabar",
        "sumber terpercaya", "info valid", "info a1", "dari grup sebelah", "kata teman", "kata saudara",
        "allegedly", "sources say", "insider says", "rumor has it", "i heard that", "anonymous source",
    )),
    Signal("klaim_mutlak", "Klaim mutlak atau terlalu bagus", 25, (
        "100 persen", "dijamin", "pasti sembuh", "tanpa efek samping", "terbukti ampuh", "ampuh",
        "menyembuhkan", "sembuh total", "dalam 3 hari", "dalam sehari", "dalam semalam", "obat segala penyakit",
        "dokter tidak mau kamu tahu", "miracle", "guaranteed", "cures", "doctors hate", "instantly", "overnight",
        "no side effects", "secret remedy",
    )),
    Signal("ajakan_klik", "Ajakan klik, daftar, atau transfer", 30, (
        "klik link", "klik tautan", "link di bio", "daftar sekarang", "daftar di sini", "isi data", "kirim otp",
        "transfer dulu", "saldo gratis", "hadiah langsung", "klaim hadiah", "bit ly", "wa me", "s id",
        "click the link", "link in bio", "claim your", "sign up now", "limited time", "send your", "dm to claim",
    )),
    Signal("provokasi", "Ajakan bermusuhan atau kekerasan", 30, (
        "ganyang", "usir mereka", "bubarkan", "hancurkan", "bakar", "habisi", "lawan sampai", "jangan diam saja",
        "saatnya bergerak", "turun ke jalan", "perang saudara", "kafir", "pengkhianat bangsa",
        "kick them out", "burn it down", "take to the streets", "civil war", "traitors", "rise up",
    )),
    Signal("menakuti", "Menakut-nakuti", 15, (
        "awas", "waspada", "bahaya", "darurat", "segera mengungsi", "jangan keluar rumah", "korban berjatuhan",
        "siaga satu", "mencekam", "warning", "urgent", "evacuate now", "stay indoors", "state of emergency",
    )),
)

_COMPILED = [
    (s, re.compile(r"(?<![\w])(" + "|".join(re.escape(normalize(t)) for t in s.terms) + r")(?![\w])"))
    for s in SIGNALS
]
_SHOUT = re.compile(r"[!?]{3,}|!{2,}")
_WORDS = re.compile(r"[^\W\d_]{4,}")


@dataclass
class Risk:
    score: int
    level: str  # "rendah" | "sedang" | "tinggi"
    signals: list[dict]

    def as_dict(self) -> dict:
        return {"score": self.score, "level": self.level, "signals": self.signals}


def risk_level(score: int) -> str:
    return "tinggi" if score >= 65 else "sedang" if score >= RISK_CAUTION else "rendah"


def assess_risk(text: str) -> Risk:
    norm = normalize(text)
    found: list[dict] = []
    total = 0
    for signal, pattern in _COMPILED:
        hits = list(dict.fromkeys(pattern.findall(norm)))
        if hits:
            found.append({"id": signal.id, "label": signal.label, "weight": signal.weight, "hits": hits[:3]})
            total += signal.weight

    words = _WORDS.findall(text)
    shouting = sum(1 for w in words if w.isupper()) / len(words) if len(words) >= 4 else 0.0
    if _SHOUT.search(text) or shouting >= 0.4:
        found.append({"id": "huruf_besar", "label": "Huruf besar atau tanda seru berlebihan", "weight": 10, "hits": []})
        total += 10

    score = min(100, total)
    return Risk(score, risk_level(score), found)
