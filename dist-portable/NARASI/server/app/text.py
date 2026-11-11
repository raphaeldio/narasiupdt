"""Normalisasi teks Bahasa Indonesia dan ekstraksi konteks (siapa, apa, kapan, di mana)."""

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field

from .lang import is_unspaced

STOPWORDS = {
    "yang", "dan", "di", "ke", "dari", "pada", "untuk", "dengan", "ini", "itu", "akan", "bakal",
    "telah", "sudah", "sedang", "juga", "atau", "oleh", "dalam", "para", "adalah", "ada", "tidak",
    "bukan", "agar", "karena", "saat", "sebagai", "bagi", "kita", "kami", "kamu", "anda", "saya",
    "aku", "mereka", "dia", "ia", "nya", "lah", "kah", "pun", "si", "sang", "the", "a", "an", "of",
    "to", "in", "on", "and", "is", "are", "be", "will", "for", "by", "with", "this", "that", "yg",
    "dgn", "utk", "tdk", "gak", "nggak", "ga", "aja", "saja", "lagi", "masih", "harus", "bisa",
    "segera", "hari", "tanggal", "tgl", "breaking", "viral", "news", "info", "berita", "sebarkan",
    "share", "fyp", "foryou", "reels", "shorts",
    # Kata fungsi Inggris tambahan (konten luar negeri).
    "was", "were", "has", "have", "had", "been", "it", "its", "at", "as", "from", "not", "but", "or", "they",
    "their", "he", "she", "his", "her", "you", "your", "we", "our", "who", "what", "which", "when", "there",
    "do", "does", "did", "just", "than", "then", "so", "if", "into", "about", "after", "before", "can", "would",
}

MONTHS = {
    "januari": 1, "jan": 1, "january": 1, "februari": 2, "feb": 2, "february": 2, "maret": 3,
    "mar": 3, "march": 3, "april": 4, "apr": 4, "mei": 5, "may": 5, "juni": 6, "jun": 6, "june": 6,
    "juli": 7, "jul": 7, "july": 7, "agustus": 8, "agu": 8, "agt": 8, "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9, "oktober": 10, "okt": 10, "october": 10, "oct": 10,
    "november": 11, "nov": 11, "desember": 12, "des": 12, "december": 12, "dec": 12,
}

# Provinsi dan kota besar; cukup untuk penjaga konteks "di mana".
LOCATIONS = {
    "aceh", "sumatera utara", "sumut", "medan", "sumatera barat", "sumbar", "padang", "riau",
    "pekanbaru", "jambi", "sumatera selatan", "sumsel", "palembang", "bengkulu", "lampung",
    "bangka belitung", "kepulauan riau", "batam", "jakarta", "dki", "jawa barat", "jabar", "bandung",
    "bogor", "depok", "bekasi", "tasikmalaya", "garut", "cirebon", "sukabumi", "jawa tengah",
    "jateng", "semarang", "solo", "surakarta", "yogyakarta", "jogja", "diy", "jawa timur", "jatim",
    "surabaya", "kota malang", "banten", "kota serang", "tangerang", "bali", "denpasar", "ntb", "mataram",
    "ntt", "kupang", "kalimantan barat", "kalbar", "pontianak", "kalimantan tengah", "kalteng",
    "kalimantan selatan", "kalsel", "banjarmasin", "kalimantan timur", "kaltim", "samarinda",
    "balikpapan", "ikn", "nusantara", "kalimantan utara", "kaltara", "sulawesi utara", "sulut",
    "manado", "gorontalo", "sulawesi tengah", "sulteng", "palu", "sulawesi selatan", "sulsel",
    "makassar", "sulawesi tenggara", "sultra", "kendari", "sulawesi barat", "sulbar", "maluku",
    "ambon", "maluku utara", "ternate", "papua", "jayapura", "papua barat", "manokwari", "sorong",
    "papua tengah", "papua pegunungan", "papua selatan", "merauke", "timika", "poso", "natuna",
}

_URL = re.compile(r"https?://\S+|www\.\S+")
_MENTION = re.compile(r"[@#][\w.]+")
_UNIT = re.compile(
    r"\b(kodam|kodim|korem|koramil|yonif|yon|brigif|lanud|lantamal|kostrad|kopassus|divif)\s*"
    r"([0-9ivxlc]+(?:\s*/\s*[a-z0-9]+)?)"
)
_DATE_NUMERIC = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")
_DATE_WORDS = re.compile(r"\b(\d{1,2})\s+([a-z]+)\s*(\d{4})?\b")
_YEAR = re.compile(r"\b(19[5-9]\d|20[0-4]\d)\b")


def normalize(text: str) -> str:
    """Huruf kecil tanpa tanda baca. Diakritik Latin dibuang; aksara lain (Arab, Han, Kiril, Thai, …) dipertahankan."""
    out: list[str] = []
    latin = True
    for c in unicodedata.normalize("NFKD", _URL.sub(" ", text)):
        if unicodedata.combining(c):
            if not latin:
                out.append(c)  # tanda vokal Devanagari/Thai/Arab adalah bagian dari kata
            continue
        if c.isalnum():
            latin = c.isascii()
            out.append(c.lower())
        else:
            out.append(c if c == "/" else " ")
    return re.sub(r"\s+", " ", "".join(out)).strip()


def claim_hash(text: str) -> str:
    return hashlib.sha1(normalize(text).encode()).hexdigest()[:12]


def stem(word: str) -> str:
    """Stemmer ringan Bahasa Indonesia: cukup untuk menyamakan 'menyerang' dan 'serang'."""
    if len(word) <= 4 or word.isdigit():
        return word
    for suffix in ("kannya", "annya", "kan", "nya", "an", "lah", "kah"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            word = word[: -len(suffix)]
            break
    rules = (
        ("meny", "s"), ("peny", "s"), ("meng", ""), ("peng", ""), ("mem", "p"), ("pem", "p"),
        ("men", "t"), ("pen", "t"), ("me", ""), ("di", ""), ("ber", ""), ("ter", ""),
    )
    for prefix, repl in rules:
        if word.startswith(prefix) and len(word) - len(prefix) >= 4:
            rest = word[len(prefix):]
            # "men"+vokal → t (menembak→tembak); "men"+konsonan → hapus (mendapat→dapat)
            if prefix in ("men", "pen") and rest[0] not in "aeiou":
                return rest
            if prefix in ("mem", "pem") and rest[0] not in "aeiou":
                return rest
            if prefix in ("meny", "peny") and rest[0] not in "aeiou":
                return rest
            return repl + rest
    return word


def tokens(text: str) -> list[str]:
    out: list[str] = []
    for w in normalize(text).split():
        if any(is_unspaced(c) for c in w):
            # Mandarin/Jepang/Thai ditulis tanpa spasi: bigram karakter menggantikan kata.
            out.extend(w[i : i + 2] for i in range(max(1, len(w) - 1)))
        elif len(w) > 1 and w not in STOPWORDS:
            out.append(stem(w) if w.isascii() else w)
    return out


def keywords(text: str, limit: int = 8) -> str:
    """Kata kunci pencarian: kata bermakna dalam urutan aslinya (tanpa stemming, hashtag, atau mention)."""
    seen: list[str] = []
    for w in normalize(_MENTION.sub(" ", text)).split():
        if len(w) > 1 and w not in STOPWORDS and w not in seen:
            seen.append(w)
    return " ".join(seen[:limit])


def trigrams(text: str) -> set[str]:
    s = f"  {normalize(text)}  "
    return {s[i : i + 3] for i in range(len(s) - 2)}


def dice(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return 2 * len(a & b) / (len(a) + len(b))


def lexical_similarity(a: str, b: str) -> float:
    return 0.6 * dice(set(tokens(a)), set(tokens(b))) + 0.4 * dice(trigrams(a), trigrams(b))


@dataclass
class Context:
    dates: set[tuple[int, int]] = field(default_factory=set)  # (hari, bulan)
    years: set[int] = field(default_factory=set)
    locations: set[str] = field(default_factory=set)
    units: set[str] = field(default_factory=set)
    content: set[str] = field(default_factory=set)  # kata "apa" setelah entitas dibuang


def extract_context(text: str) -> Context:
    norm = normalize(text)
    ctx = Context()
    for d, m, y in _DATE_NUMERIC.findall(norm):
        if 1 <= int(d) <= 31 and 1 <= int(m) <= 12:
            ctx.dates.add((int(d), int(m)))
            ctx.years.add(int(y) if len(y) == 4 else 2000 + int(y))
    for d, month, y in _DATE_WORDS.findall(norm):
        if month in MONTHS and 1 <= int(d) <= 31:
            ctx.dates.add((int(d), MONTHS[month]))
            if y:
                ctx.years.add(int(y))
    ctx.years |= {int(y) for y in _YEAR.findall(norm)}
    padded = f" {norm} "
    ctx.locations = {loc for loc in LOCATIONS if f" {loc} " in padded}
    ctx.units = {f"{kind} {num.replace(' ', '')}" for kind, num in _UNIT.findall(norm)}

    entity_words = set()
    for loc in ctx.locations:
        entity_words |= set(loc.split())
    for unit in ctx.units:
        entity_words |= set(unit.replace("/", " ").split())
    entity_words |= set(MONTHS)
    entity_words |= {"tni", "ad", "au", "al", "polri", "indonesia", "ri", "warga", "masyarakat"}
    ctx.content = {
        stem(w) for w in norm.split()
        if len(w) > 2 and w not in STOPWORDS and w not in entity_words and not w.isdigit()
    }
    return ctx
