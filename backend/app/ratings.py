"""Pemetaan rating fact-check ke nilai v(e) dan kredibilitas sumber (PRD Bagian 8)."""

from urllib.parse import urlparse

from .text import normalize

_FALSE = (
    "salah", "hoaks", "hoax", "false", "palsu", "keliru", "disinformasi", "fabricated", "pants on fire",
    "tidak benar", "fake", "bohong", "manipulasi", "misinformasi", "incorrect", "inaccurate",
    "penipuan", "fitnah", "scam", "debunked", "no evidence", "not true", "altered", "doctored", "ai generated",
    "wrong", "baseless", "unfounded", "fabrication", "deepfake",
    # Pemeriksa fakta berbahasa lain (rating Google Fact Check apa adanya).
    "falso", "falsa", "faux", "fausse", "falsch", "enganoso", "enganosa", "mentira", "bulo", "yanlis", "sai",
)
_MIXED = (
    "menyesatkan", "sebagian", "misleading", "partly", "partially", "missing context", "kurang konteks",
    "konteks keliru", "mixture", "half", "out of context", "unproven", "belum terbukti",
)
_TRUE = ("benar", "true", "fakta", "correct", "accurate", "akurat", "diberitakan", "terkonfirmasi", "confirmed",
         "verdadero", "verdadeiro", "vrai", "richtig", "wahr")
_SATIRE = ("satire", "satir", "parodi", "parody")

# Pemeriksa fakta bersertifikat IFCN dan sumber resmi pemerintah/TNI.
TIER1_DOMAINS = {
    "turnbackhoax.id", "cekfakta.com", "cekfakta.tempo.co", "komdigi.go.id", "kominfo.go.id",
    "tniad.mil.id", "ppid.tniad.mil.id", "tni.mil.id", "puspen.tni.mil.id", "factcheck.afp.com",
    "mafindo.or.id", "tirto.id",
}
# Media arus utama terverifikasi.
TIER2_DOMAINS = {
    "kompas.com", "liputan6.com", "tempo.co", "antaranews.com", "detik.com", "cnnindonesia.com",
    "republika.co.id", "tvrinews.com", "rri.co.id", "kumparan.com", "suara.com", "merdeka.com",
    "medcom.id", "beritasatu.com", "idntimes.com", "jawapos.com", "mediaindonesia.com",
}
# Pemeriksa fakta internasional (jaringan IFCN) dan rubrik cek fakta kantor berita dunia.
INTL_FACTCHECK_DOMAINS = {
    "snopes.com", "politifact.com", "factcheck.org", "fullfact.org", "leadstories.com", "africacheck.org",
    "boomlive.in", "altnews.in", "factly.in", "verafiles.org", "rappler.com", "chequeado.com", "maldita.es",
    "newtral.es", "aosfatos.org", "correctiv.org", "factcheck.kz", "stopfake.org", "misbar.com", "fatabyyano.net",
    "mythdetector.com", "factcheck.afp.com", "checkyourfact.com", "science.feedback.org", "healthfeedback.org",
    "climatefeedback.org", "logicallyfacts.com", "dpa-factchecking.com", "factcheckcenter.jp", "tfc-taiwan.org.tw",
}
# Kantor berita dan media internasional arus utama.
INTL_NEWS_DOMAINS = {
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "afp.com", "dw.com", "aljazeera.com", "theguardian.com",
    "nytimes.com", "washingtonpost.com", "bloomberg.com", "npr.org", "channelnewsasia.com", "straitstimes.com",
    "scmp.com", "nhk.or.jp", "abc.net.au", "cbc.ca", "france24.com", "lemonde.fr", "elpais.com", "thehindu.com",
    "bernama.com", "thestar.com.my", "inquirer.net", "voanews.com", "voaindonesia.com", "cnn.com", "nbcnews.com",
    "cbsnews.com", "abcnews.go.com", "usatoday.com", "time.com", "nature.com", "who.int", "un.org",
}
TIER1_DOMAINS |= INTL_FACTCHECK_DOMAINS
TIER2_DOMAINS |= INTL_NEWS_DOMAINS | {"infopublik.id", "tribunnews.com", "okezone.com", "viva.co.id", "bisnis.com",
                                      "kontan.co.id", "katadata.co.id", "inews.id", "sindonews.com", "jpnn.com",
                                      "metrotvnews.com", "kompas.id", "kompas.tv", "cnbcindonesia.com"}
# Whitelist pencarian (PRD FR06): gabungan kedua tingkat.
SEARCH_DOMAINS = sorted(TIER1_DOMAINS | TIER2_DOMAINS)


def is_trusted(url: str) -> bool:
    domain = domain_of(url)
    return _in(domain, TIER1_DOMAINS) or _in(domain, TIER2_DOMAINS)


def verdict_value(rating: str) -> float | None:
    """1.0 = bantahan, 0.6 = menyesatkan, 0.0 = benar. None = satire/tidak dikenal (tidak dihitung)."""
    r = normalize(rating)
    if not r or any(w in r for w in _SATIRE):
        return None
    # Urutan penting: "tidak benar" harus terbaca sebagai salah, bukan benar.
    if any(w in r for w in _MIXED):
        return 0.6
    if any(w in r for w in _FALSE):
        return 1.0
    if any(w in r for w in _TRUE):
        return 0.0
    return None


def is_satire_rating(rating: str) -> bool:
    return any(w in normalize(rating) for w in _SATIRE)


def domain_of(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    return host.removeprefix("www.")


def _in(domain: str, domains: set[str]) -> bool:
    return any(domain == d or domain.endswith("." + d) for d in domains)


_FACTCHECK_PATH = ("cekfakta", "cek-fakta", "cek_fakta", "hoaks", "hoax", "factcheck", "fact-check", "klarifikasi",
                   "hoax-alert", "factchecks", "verify", "reality-check")
_FACTCHECK_TITLE = ("hoaks", "hoax", "cek fakta", "fact check", "factcheck", "salah", "penipuan", "disinformasi",
                    "klarifikasi", "debunk", "fact checked", "verifikasi")


def is_factcheck_title(title: str) -> bool:
    """Judul yang jelas artikel cek fakta, mis. "[HOAKS] …" atau "Fact Check: …" (hasil Google News tanpa URL asli)."""
    t = normalize(title)
    return any(f" {w} " in f" {t} " or t.startswith(w) for w in _FACTCHECK_TITLE)


def is_factcheck_page(url: str) -> bool:
    """Halaman cek fakta atau sumber resmi (pemerintah/TNI/pemeriksa fakta IFCN)."""
    lowered = url.lower()
    return _in(domain_of(url), TIER1_DOMAINS) or any(p in lowered for p in _FACTCHECK_PATH)


def credibility(url: str, *, from_factcheck_api: bool = False) -> float:
    domain = domain_of(url)
    if _in(domain, TIER1_DOMAINS):
        return 1.0
    # Rubrik cek fakta media arus utama (mis. kompas.com/cekfakta, liputan6.com/cek-fakta).
    if _in(domain, TIER2_DOMAINS) and ("cekfakta" in url or "cek-fakta" in url):
        return 1.0
    if _in(domain, TIER2_DOMAINS):
        return 0.8
    # Penerbit ClaimReview di Google Fact Check umumnya organisasi pemeriksa fakta.
    if from_factcheck_api:
        return 0.8
    return 0.5
