"""Pendekatan selain Google Fact Check: indeks feed pemeriksa fakta, pencarian berita, pola bahasa, multibahasa."""

import asyncio

from app.advisor import baseline, recommend
from app.cache import MemoryCache
from app.claims import extract_claims
from app.corpus import Corpus
from app.evidence import EvidenceFinder
from app.feeds import FactFeedIndex, parse_feed, rating_and_claim
from app.lang import detect_language
from app.models import Claim
from app.providers.newsrss import NewsHit, parse_news
from app.scoring import aggregate
from app.signals import assess_risk
from app.text import normalize, tokens
from app.topics import classify

RSS = """<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>[SALAH] Transaksi Digital Wajib Dipungut Pajak Mulai 9 November 2026</title>
<link>https://turnbackhoax.id/articles/1-salah-pajak</link><description>&lt;p&gt;Faktanya tidak ada.&lt;/p&gt;</description>
<pubDate>Mon, 09 Nov 2026 10:00:00 +0000</pubDate></item>
<item><title>[PENIPUAN] Tautan Pendaftaran BPJS di Klinik Kopdes</title>
<link>https://turnbackhoax.id/articles/2-penipuan-bpjs</link></item>
</channel></rss>"""

ATOM = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Fact Check: FBI, DHS Did NOT Seize Voting Machines In Texas And Arizona</title>
<link rel="alternate" href="https://leadstories.com/hoax-alert/2026/11/fbi.html"/>
<published>2026-11-10T02:35:49Z</published><summary>Did the FBI seize machines? No.</summary></entry></feed>"""

NEWS = """<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Jembatan Baru di Kendari Diresmikan 12 Desember 2026 - Kompas.com</title>
<link>https://news.google.com/rss/articles/abc</link><pubDate>Sat, 12 Dec 2026 03:00:00 GMT</pubDate>
<source url="https://www.kompas.com">Kompas.com</source></item>
<item><title>Blog acak soal jembatan - Blog Entah</title><link>https://news.google.com/rss/articles/def</link>
<source url="https://blog-entah.example">Blog Entah</source></item>
</channel></rss>"""


def test_language_detection_and_unicode_text():
    assert detect_language("TNI akan menyerang Aceh besok") == "id"
    assert detect_language("The president has signed a new law that will ban the app") == "en"
    assert detect_language("El presidente dijo que no hay vacunas para los niños") == "es"
    assert detect_language("Путин объявил о новой мобилизации") == "ru"
    assert detect_language("新冠疫苗会导致不孕") == "zh"
    assert detect_language("keren banget") == "id"
    # Aksara non-Latin tidak lagi hilang saat dinormalisasi, dan teks tanpa spasi dipecah jadi bigram.
    assert "привет" in normalize("«Привет», мир!")
    assert tokens("疫苗导致不孕") == ["疫苗", "苗导", "导致", "致不", "不孕"]


def test_foreign_claims_are_extracted_with_topic():
    [claim] = extract_claims("The FBI seized voting machines in Texas on Nov 7, 2026.", "caption")
    assert claim.language == "en" and claim.topic in ("kriminal", "politik")
    [zh] = extract_claims("新冠疫苗会导致不孕，政府隐瞒了真相2026", "caption")
    assert zh.language == "zh"
    assert extract_claims("I love this so much, thank you!", "caption") == []


def test_topics_cover_more_than_tni():
    assert classify("Gempa megathrust akan mengguncang Jakarta kata BMKG")[0] == "bencana"
    assert classify("Klik link ini untuk klaim hadiah undian saldo gratis")[0] == "penipuan"
    assert classify("Vaccine causes autism, doctors admit")[0] == "kesehatan"
    assert classify("Prajurit Kodam dikerahkan ke perbatasan")[0] == "pertahanan"
    assert classify("lagi santai sore") == ["umum"]


def test_feed_titles_give_rating_and_claim():
    assert rating_and_claim("[SALAH] Kapolri Copot Kapolda Jateng", "id") == ("Salah", "Kapolri Copot Kapolda Jateng")
    assert rating_and_claim("Fact Check: FBI Did NOT Seize Voting Machines", "en")[0] == "False"
    assert rating_and_claim("Did Democrats win every state?", "en")[0] == ""
    rss = parse_feed(RSS, "TurnBackHoax (Mafindo)", "id")
    assert [e.rating for e in rss] == ["Salah", "Penipuan"] and rss[0].date == "2026-11-09"
    [atom] = parse_feed(ATOM, "Lead Stories", "en")
    assert atom.url.startswith("https://leadstories.com/") and atom.rating == "False"
    # XML rusak (prefix namespace tak dideklarasikan) tetap terbaca.
    broken = RSS.replace("<item>", "<item><foo:bar>x</foo:bar>", 1)
    assert len(parse_feed(broken, "X", "id")) == 2


def test_feed_index_refutes_without_any_api_key():
    index = FactFeedIndex(None, None)
    index.add(parse_feed(RSS, "TurnBackHoax (Mafindo)", "id") + parse_feed(ATOM, "Lead Stories", "en"))
    finder = EvidenceFinder(Corpus(False), MemoryCache(), 60, 2, None, None, None, feeds=index)

    claim = Claim(id="c1", text="Transaksi digital wajib dipungut pajak mulai 9 November 2026", source="caption")
    evidence = asyncio.run(finder.quick(claim))
    assert evidence and evidence[0].origin == "feed" and evidence[0].verdict == 1.0
    assert aggregate([claim], evidence).label == "hoax"

    english = Claim(id="c2", text="FBI and DHS seized voting machines in Texas and Arizona", source="caption",
                    language="en")
    assert aggregate([english], asyncio.run(finder.quick(english))).label == "hoax"


def test_news_search_keeps_only_trusted_media():
    hits = parse_news(NEWS)
    assert [h.publisher for h in hits] == ["Kompas.com"]
    assert hits[0].title == "Jembatan Baru di Kendari Diresmikan 12 Desember 2026" and hits[0].date == "2026-12-12"


def test_trusted_news_supports_but_never_refutes_without_llm():
    class FakeNews:
        def __init__(self, hits):
            self.hits = hits

        async def search(self, query, timeout, language="id"):
            return self.hits

    def run(text, title):
        news = FakeNews([NewsHit(title, "https://news.google.com/rss/articles/x", "Kompas.com",
                                 "https://www.kompas.com", "2026-12-12")])
        finder = EvidenceFinder(Corpus(False), MemoryCache(), 60, 2, None, None, None, news=news)
        claim = Claim(id="n" + str(abs(hash(title))), text=text, source="caption")
        return claim, asyncio.run(finder.find(claim))

    claim, evidence = run("Jembatan baru di Kendari akan diresmikan pada 12 Desember 2026",
                          "Jembatan Baru di Kendari Diresmikan 12 Desember 2026")
    assert evidence and evidence[0].origin == "news" and evidence[0].verdict == 0.0
    assert aggregate([claim], evidence).label == "supported"

    # Judul bernada meragukan ("Viral kabar …") tidak dihitung mendukung.
    _, hedged = run("Jembatan baru di Kendari akan diresmikan pada 12 Desember 2026",
                    "Viral Kabar Jembatan Baru di Kendari Diresmikan 12 Desember 2026")
    assert hedged == []
    # Berita umum berjudul "hoaks" tanpa penanda cek fakta dari media terverifikasi tetap dihitung bantahan
    # hanya bila judulnya artikel cek fakta.
    claim2, refuted = run("TNI bakal serang Aceh pada 1 November 2026", "[HOAKS] TNI Bakal Serang Aceh pada 1 November 2026")
    assert refuted and refuted[0].verdict == 1.0


def test_risk_signals_raise_unverified_to_caution_but_never_hoax():
    risk = assess_risk("Katanya besok semua ATM diblokir!! Sebarkan sebelum dihapus, media menutupi kabar ini")
    assert risk.score >= 45 and {s["id"] for s in risk.signals} >= {"urgensi", "sumber_anonim", "konspirasi"}
    claim = Claim(id="c", text="Besok semua ATM diblokir", source="caption")
    verdict = aggregate([claim], [], risk)
    assert (verdict.label, verdict.basis, verdict.score) == ("caution", "signals", None)
    assert assess_risk("Jembatan baru diresmikan gubernur hari ini").score == 0
    assert aggregate([claim], [], assess_risk("Besok semua ATM diblokir")).label == "unverified"


def test_ai_assessment_only_counts_when_confident():
    claim = Claim(id="c", text="Bumi itu datar", source="caption")
    low = aggregate([claim], [], None, {"verdict": "likely_false", "confidence": 0.5})
    high = aggregate([claim], [], None, {"verdict": "likely_false", "confidence": 0.9})
    assert low.label == "unverified"
    assert (high.label, high.basis, high.confidence) == ("caution", "ai", "low")
    assert aggregate([], [], None).label == "neutral"


def test_recommendations_follow_evidence_and_topic():
    hoax = {"label": "hoax", "basis": "evidence", "level": "tinggi", "rising": True, "tni_related": True,
            "topic": "pertahanan", "reports": 3, "videos": 4, "platforms": {"tiktok": 2, "instagram": 2}}
    ids = [a["id"] for a in recommend(hoax, {"klarifikasi"})]
    assert ids[0] in ("klarifikasi", "takedown") and {"klarifikasi", "takedown", "eskalasi"} <= set(ids)
    assert next(a for a in recommend(hoax, {"klarifikasi"}) if a["id"] == "klarifikasi")["done"] is True

    health = {"label": "hoax", "basis": "evidence", "level": "sedang", "rising": False, "tni_related": False,
              "topic": "kesehatan", "reports": 0, "videos": 1, "platforms": {"tiktok": 1}}
    first = recommend(health)[0]
    assert first["id"] == "teruskan" and "Kemenkes" in first["owner"]

    pattern = {"label": "caution", "basis": "signals", "level": "sedang", "rising": False, "tni_related": True,
               "topic": "pertahanan", "reports": 0, "videos": 1, "platforms": {"tiktok": 1}}
    assert recommend(pattern)[0]["id"] == "cek_fakta"
    assert baseline(12, 4, 40) == {"rate": 12.0, "growth": 3.0, "reach": 40.0}


def test_title_rating_ignores_incidental_words():
    from app.evidence import rating_from_title

    assert rating_from_title("Rekrutmen TNI AD 2026, Cara Daftarnya untuk Hindari Penipuan") == ""
    assert rating_from_title("Salah satu jembatan di Kendari diresmikan") == ""
    assert rating_from_title("Masalah banjir Jakarta") == ""
    assert rating_from_title("[PENIPUAN] Tautan Pendaftaran BPJS") == "Penipuan"
    assert rating_from_title("[HOAKS] TNI Bakal Serang Aceh") == "Hoaks"
    assert rating_from_title("Kabar ATM diblokir itu tidak benar") == "Hoaks"
