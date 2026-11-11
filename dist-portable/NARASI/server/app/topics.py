"""Taksonomi isu: setiap klaim diberi topik agar dashboard tidak hanya melihat isu TNI.

Pencocokan kata kunci (Indonesia + Inggris) pada teks ternormalisasi. Ringan dan deterministik,
jadi bisa dipakai di jalur scan feed tanpa LLM; LLM boleh mengoreksi topik saat tersedia.
"""

import re

from .text import normalize

# Urutan = prioritas saat jumlah kata kunci seri.
TOPICS: dict[str, dict] = {
    "pertahanan": {
        "label": "Pertahanan & TNI",
        "terms": [
            "tni", "tni ad", "tni al", "tni au", "angkatan darat", "tentara", "prajurit", "kodam", "kodim", "korem",
            "koramil", "kostrad", "kopassus", "babinsa", "dandim", "danrem", "pangdam", "ksad", "kasad", "panglima",
            "yonif", "batalyon", "dispenad", "marinir", "militer", "alutsista", "latihan perang", "wajib militer",
            "military", "army", "soldier", "soldiers", "troops", "navy", "air force", "missile", "airstrike",
            "warship", "invasion", "invade", "nuclear", "drone strike",
        ],
    },
    "kesehatan": {
        "label": "Kesehatan",
        "terms": [
            "vaksin", "vaksinasi", "obat", "herbal", "kanker", "diabetes", "menyembuhkan", "virus", "covid",
            "wabah", "pandemi", "bpjs", "rumah sakit", "dokter", "kemenkes", "penyakit", "stroke", "jantung",
            "imunisasi", "stunting", "gizi", "tramadol", "asam urat", "kolesterol", "autisme", "hiv",
            "vaccine", "vaccines", "cure", "cures", "cancer", "outbreak", "pandemic", "disease", "autism",
            "doctor", "hospital", "medicine", "treatment", "detox",
        ],
    },
    "politik": {
        "label": "Politik & pemerintahan",
        "terms": [
            "presiden", "wakil presiden", "wapres", "menteri", "dpr", "mpr", "pemilu", "pilkada", "pilpres",
            "kpu", "bawaslu", "partai", "gubernur", "bupati", "wali kota", "kabinet", "undang undang", "ruu",
            "kebijakan", "pemerintah", "istana", "korupsi", "kpk", "demo", "unjuk rasa", "makar", "kudeta",
            "president", "election", "elections", "ballot", "ballots", "senate", "congress", "parliament",
            "prime minister", "government", "democrats", "republicans", "voter", "votes", "impeach",
        ],
    },
    "bencana": {
        "label": "Bencana & cuaca",
        "terms": [
            "gempa", "tsunami", "banjir", "longsor", "erupsi", "gunung meletus", "bmkg", "bnpb", "bpbd",
            "megathrust", "angin puting beliung", "kebakaran hutan", "cuaca ekstrem", "siklon", "mengungsi",
            "pengungsi", "evakuasi", "earthquake", "flood", "hurricane", "wildfire", "eruption", "tornado",
            "typhoon", "landslide",
        ],
    },
    "penipuan": {
        "label": "Penipuan & finansial",
        "terms": [
            "undian", "hadiah", "giveaway", "pinjol", "pinjaman online", "investasi", "saldo gratis", "bansos",
            "bantuan langsung tunai", "blt", "link pendaftaran", "tautan pendaftaran", "lowongan", "rekrutmen",
            "transfer", "rekening", "ojk", "phishing", "penipuan", "modus", "kode otp", "dana kaget", "kripto",
            "scam", "lottery", "prize", "crypto", "bitcoin", "free money", "airdrop", "ponzi", "fraud",
        ],
    },
    "sara": {
        "label": "SARA & sosial",
        "terms": [
            "agama", "islam", "kristen", "katolik", "hindu", "buddha", "yahudi", "masjid", "gereja", "ulama",
            "pesantren", "suku", "etnis", "ras", "penistaan", "kafir", "pribumi", "imigran", "pengungsi rohingya",
            "rohingya", "lgbt", "intoleransi", "muslim", "muslims", "christian", "jewish", "immigrants",
            "migrants", "racist", "refugees",
        ],
    },
    "internasional": {
        "label": "Isu internasional",
        "terms": [
            "palestina", "israel", "gaza", "ukraina", "rusia", "china", "tiongkok", "amerika", "amerika serikat",
            "iran", "korea utara", "nato", "pbb", "asean", "malaysia", "laut china selatan", "natuna", "taiwan",
            "trump", "putin", "xi jinping", "netanyahu", "hamas", "houthi", "india", "pakistan",
            "ukraine", "russia", "palestine", "united states", "north korea", "south china sea", "european union",
            "united nations", "kremlin", "white house", "pentagon",
        ],
    },
    "teknologi": {
        "label": "Teknologi & AI",
        "terms": [
            "deepfake", "kecerdasan buatan", "chatgpt", "peretas", "diretas", "hacker", "data bocor",
            "kebocoran data", "aplikasi", "whatsapp", "5g", "chip", "satelit", "starlink", "buatan ai",
            "ai generated", "artificial intelligence", "hacked", "data breach", "malware", "spyware",
        ],
    },
    "kriminal": {
        "label": "Kriminal & keamanan",
        "terms": [
            "polisi", "polri", "polda", "polres", "kapolri", "penculikan", "diculik", "begal", "pembunuhan",
            "narkoba", "teroris", "terorisme", "bom", "penembakan", "ditangkap", "tersangka", "kerusuhan",
            "tawuran", "pemerkosaan", "police", "kidnapping", "murder", "shooting", "terrorist", "arrested",
            "riot", "fbi", "raid",
        ],
    },
    "ekonomi": {
        "label": "Ekonomi",
        "terms": [
            "harga", "bbm", "pertamina", "rupiah", "dolar", "inflasi", "phk", "subsidi", "pajak", "utang negara",
            "beras", "minyak goreng", "listrik", "pln", "bank indonesia", "umr", "ump", "gaji", "tarif",
            "inflation", "recession", "tax", "taxes", "tariff", "tariffs", "stock market", "net worth", "wages",
        ],
    },
}

GENERAL = "umum"
TOPIC_LABELS = {key: spec["label"] for key, spec in TOPICS.items()} | {GENERAL: "Umum"}

# Instansi rujukan per topik, dipakai rekomendasi aksi di dashboard.
TOPIC_AUTHORITY = {
    "pertahanan": "Dispenad / Puspen TNI",
    "kesehatan": "Kemenkes / Dinas Kesehatan",
    "politik": "Komdigi / Bawaslu",
    "bencana": "BMKG / BNPB",
    "penipuan": "Komdigi / OJK",
    "sara": "Komdigi / Kemenag",
    "internasional": "Kemlu / Puspen TNI",
    "teknologi": "Komdigi / BSSN",
    "kriminal": "Polri",
    "ekonomi": "Kemenkeu / Bank Indonesia",
    GENERAL: "Komdigi",
}

_PATTERNS = {
    key: re.compile(r"(?<![\w])(" + "|".join(re.escape(t) for t in sorted(spec["terms"], key=len, reverse=True)) + r")(?![\w])")
    for key, spec in TOPICS.items()
}


def classify(text: str, limit: int = 2) -> list[str]:
    """Topik teks, paling kuat dulu. Selalu mengembalikan minimal satu ("umum" bila tidak ada yang cocok)."""
    norm = normalize(text)
    hits = [(len(set(p.findall(norm))), -i, key) for i, (key, p) in enumerate(_PATTERNS.items())]
    ranked = [key for n, _, key in sorted(hits, reverse=True) if n > 0]
    return ranked[:limit] or [GENERAL]


def primary(text: str) -> str:
    return classify(text, 1)[0]
