"""Deteksi bahasa ringan tanpa dependensi: aksara dulu, lalu kata fungsi untuk teks beraksara Latin."""

import re
import unicodedata

# (kode, rentang Unicode). Kana dicek sebelum Han agar teks Jepang tidak terbaca sebagai Mandarin.
_SCRIPTS: list[tuple[str, tuple[tuple[int, int], ...]]] = [
    ("ja", ((0x3040, 0x30FF),)),
    ("ko", ((0xAC00, 0xD7AF), (0x1100, 0x11FF))),
    ("zh", ((0x4E00, 0x9FFF), (0x3400, 0x4DBF))),
    ("ar", ((0x0600, 0x06FF), (0x0750, 0x077F))),
    ("ru", ((0x0400, 0x04FF),)),
    ("th", ((0x0E00, 0x0E7F),)),
    ("hi", ((0x0900, 0x097F),)),
    ("he", ((0x0590, 0x05FF),)),
]

# Aksara tanpa spasi antarkata: token dibentuk dari bigram karakter (lihat text.tokens).
UNSPACED = ((0x3040, 0x30FF), (0x4E00, 0x9FFF), (0x3400, 0x4DBF), (0x0E00, 0x0E7F))

_HINTS: dict[str, set[str]] = {
    "id": {"yang", "dan", "di", "ini", "itu", "dengan", "untuk", "tidak", "akan", "dari", "pada", "juga", "sudah",
           "ada", "karena", "bisa", "oleh", "atau", "saat", "telah", "para", "warga", "kami", "kita", "nggak", "gak",
           "banget", "bakal", "adalah", "dalam", "ke", "sebagai", "lagi", "jangan", "saja", "aja", "udah"},
    "en": {"the", "and", "is", "are", "was", "were", "of", "to", "in", "that", "this", "with", "for", "has", "have",
           "will", "not", "from", "by", "on", "at", "it", "they", "their", "been", "be", "as", "an", "you", "your",
           "but", "who", "what", "just", "says", "said", "after", "before", "did", "does", "do", "more", "than",
           "new", "about", "his", "her", "he", "she", "we", "our", "or", "if", "when", "which", "can", "would",
           "there", "how", "why", "into", "against", "over", "shows", "show", "all", "its", "had", "were"},
    "es": {"el", "la", "los", "las", "que", "de", "en", "y", "un", "una", "por", "con", "para", "del", "se", "es",
           "no", "como", "pero", "fue", "esta", "este", "sus", "mas", "son", "al", "lo", "su"},
    "pt": {"o", "os", "as", "que", "de", "em", "um", "uma", "para", "com", "nao", "por", "do", "da", "dos", "das",
           "foi", "mais", "como", "mas", "ao", "pelo", "pela", "voce", "sao", "esta", "tem", "na", "no"},
    "fr": {"le", "la", "les", "des", "est", "et", "en", "un", "une", "du", "que", "qui", "dans", "pour", "pas",
           "sur", "au", "avec", "ce", "cette", "sont", "ont", "ete", "par", "plus", "nous", "vous", "il", "elle"},
    "de": {"der", "die", "das", "und", "ist", "nicht", "ein", "eine", "mit", "von", "zu", "den", "auf", "fur",
           "im", "dem", "sich", "auch", "wird", "sind", "hat", "bei", "nach", "wie", "es", "ich", "sie", "wurde"},
    "tr": {"ve", "bir", "bu", "icin", "ile", "da", "de", "olarak", "cok", "daha", "gibi", "kadar", "ama", "olan",
           "var", "ne", "ben", "sen", "degil", "oldu"},
    "vi": {"va", "cua", "la", "co", "khong", "nguoi", "nhung", "mot", "cac", "duoc", "trong", "cho", "voi", "nay",
           "da", "se", "tai", "ve", "khi", "den"},
    "tl": {"ang", "ng", "mga", "sa", "na", "ay", "si", "ni", "kay", "para", "hindi", "ito", "ako", "ka", "siya",
           "kung", "naman", "pa", "lang", "po"},
    "nl": {"de", "het", "een", "en", "van", "is", "dat", "niet", "op", "te", "zijn", "voor", "met", "ook", "maar",
           "naar", "bij", "wordt", "door", "over"},
    "it": {"il", "lo", "gli", "che", "di", "e", "un", "una", "per", "non", "con", "del", "della", "sono", "ha",
           "piu", "come", "ma", "nel", "alla", "anche", "si"},
}

LANGUAGE_NAMES = {
    "id": "Indonesia", "en": "Inggris", "es": "Spanyol", "pt": "Portugis", "fr": "Prancis", "de": "Jerman",
    "tr": "Turki", "vi": "Vietnam", "tl": "Tagalog", "nl": "Belanda", "it": "Italia", "ja": "Jepang",
    "ko": "Korea", "zh": "Mandarin", "ar": "Arab", "ru": "Rusia", "th": "Thai", "hi": "Hindi", "he": "Ibrani",
}

# Edisi Google News per bahasa: (hl, gl, ceid).
NEWS_EDITIONS = {
    "id": ("id", "ID", "ID:id"), "en": ("en-US", "US", "US:en"), "es": ("es-419", "MX", "MX:es-419"),
    "pt": ("pt-BR", "BR", "BR:pt-419"), "fr": ("fr", "FR", "FR:fr"), "de": ("de", "DE", "DE:de"),
    "tr": ("tr", "TR", "TR:tr"), "vi": ("vi", "VN", "VN:vi"), "nl": ("nl", "NL", "NL:nl"),
    "it": ("it", "IT", "IT:it"), "ja": ("ja", "JP", "JP:ja"), "ko": ("ko", "KR", "KR:ko"),
    "zh": ("zh-TW", "TW", "TW:zh-Hant"), "ar": ("ar", "EG", "EG:ar"), "ru": ("ru", "RU", "RU:ru"),
    "th": ("th", "TH", "TH:th"), "hi": ("hi", "IN", "IN:hi"), "tl": ("en-PH", "PH", "PH:en"),
}

_WORD = re.compile(r"[a-z]+")


def _in(cp: int, ranges: tuple[tuple[int, int], ...]) -> bool:
    return any(lo <= cp <= hi for lo, hi in ranges)


def is_unspaced(ch: str) -> bool:
    return _in(ord(ch), UNSPACED)


def detect_language(text: str, default: str = "id") -> str:
    """Kode bahasa ISO 639-1. Teks terlalu pendek atau tanpa petunjuk dianggap `default`."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return default
    counts: dict[str, int] = {}
    for c in letters:
        cp = ord(c)
        if cp < 0x250:
            continue
        for code, ranges in _SCRIPTS:
            if _in(cp, ranges):
                counts[code] = counts.get(code, 0) + 1
                break
    if counts:
        code, n = max(counts.items(), key=lambda kv: kv[1])
        # Kanji tanpa kana = Mandarin; ada kana walau sedikit = Jepang.
        if counts.get("ja") and code == "zh":
            code, n = "ja", n + counts["ja"]
        if n >= max(2, 0.2 * len(letters)):
            return code

    folded = "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))
    words = _WORD.findall(folded)
    if len(words) < 3:
        return default
    scores = {code: sum(w in hints for w in words) for code, hints in _HINTS.items()}
    best = max(scores, key=lambda k: (scores[k], k == default))
    # Minimal dua kata fungsi dan jelas lebih unggul daripada bahasa utama, supaya caption
    # Indonesia yang diselipi istilah asing tidak salah terbaca.
    if scores[best] < 2 or scores[best] <= scores.get(default, 0):
        return default
    return best
