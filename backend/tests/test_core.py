from app.claims import extract_claims
from app.matching import MATCH_MIN, context_match
from app.models import Claim, Evidence
from app.ratings import credibility, verdict_value
from app.scoring import aggregate
from app.text import stem

KOMDIGI = "TNI bakal serang Aceh pada 1 November 2026"


def ev(claim_id, verdict, match=0.9, cred=1.0, rating="Hoaks"):
    return Evidence(claim_id=claim_id, publisher="P", title="T", url="https://x.id", rating=rating,
                    verdict=verdict, match=match, credibility=cred, origin="corpus")


def test_stem():
    assert stem("menyerang") == "serang"
    assert stem("serang") == "serang"
    assert stem("penyerangan") == "serang"
    assert stem("mengungsi") == "ungsi"
    assert stem("dibuka") == "buka"


def test_same_event_matches():
    claim = "TNI akan menyerang Aceh pada 1 November 2026, warga diminta segera mengungsi"
    assert context_match(claim, KOMDIGI) >= MATCH_MIN


def test_similar_words_different_event_rejected():
    claim = "TNI menggelar bakti sosial pengobatan gratis di Aceh pada 1 November 2026"
    assert context_match(claim, KOMDIGI) < MATCH_MIN


def test_different_date_rejected():
    claim = "TNI akan menyerang Aceh pada 17 Agustus 2026"
    assert context_match(claim, KOMDIGI) < MATCH_MIN


def test_verdict_values():
    assert verdict_value("Hoaks") == 1.0
    assert verdict_value("Tidak benar") == 1.0
    assert verdict_value("Menyesatkan") == 0.6
    assert verdict_value("Sebagian benar") == 0.6
    assert verdict_value("Benar") == 0.0
    assert verdict_value("Satire") is None
    assert verdict_value("Klarifikasi") is None


def test_credibility_tiers():
    assert credibility("https://turnbackhoax.id/2026/x") == 1.0
    assert credibility("https://www.kompas.com/cekfakta/read/x") == 1.0
    assert credibility("https://news.detik.com/x") == 0.8
    assert credibility("https://blog.example.com/x") == 0.5


def test_score_formula_and_bands():
    c = Claim(id="c1", text="x", source="caption")
    # (0.9*1*1 + 0.8*0.8*0.6) / (0.9 + 0.64) = 0.8338
    v = aggregate([c], [ev("c1", 1.0, 0.9), ev("c1", 0.6, 0.8, 0.8, "Menyesatkan")])
    assert v.score == 83 and v.label == "hoax" and v.confidence == "high"


def test_insufficient_weight_is_unverified_not_zero():
    c = Claim(id="c1", text="x", source="caption")
    v = aggregate([c], [ev("c1", 0.0, match=0.7, cred=0.5)])  # w = 0.35 < 0.6
    assert v.score is None and v.label == "unverified"


def test_supported_label():
    c = Claim(id="c1", text="x", source="caption")
    v = aggregate([c], [ev("c1", 0.0, rating="Benar")])
    assert v.score == 0 and v.label == "supported" and v.confidence == "medium"


def test_satire_and_opinion():
    assert aggregate([Claim(id="s", text="x", source="caption", kind="satire")], []).label == "satire"
    assert extract_claims("Bangga banget lihat defile prajurit kita, keren!", "caption") == []


def test_claims_prioritise_tni():
    claims = extract_claims(
        "Harga beras naik 20 persen di Jakarta mulai Senin. TNI akan menyerang Aceh pada 1 November 2026.",
        "caption",
    )
    assert claims[0].tni_related


def test_stats_timeline_counts_current_hour():
    from app.models import AnalysisResult
    from app.stats import Stats

    stats = Stats()
    stats.record(AnalysisResult(platform="testbed", video_id="a", stage="final", final=True, score=90, label="hoax",
                                confidence="high", tni_related=True, claims=[], evidence=[], conclusion=None), False)
    summary = stats.summary(24)
    assert len(summary["timeline"]) == 24
    assert summary["timeline"][-1]["hours_ago"] == 0 and summary["timeline"][-1]["hoax"] == 1


def test_gemini_falls_back_when_primary_overloaded():
    import asyncio

    import httpx

    from app.providers.gemini import Gemini

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = request.url.path.split("/")[-1].split(":")[0]
        calls.append(model)
        if model == "primary":
            return httpx.Response(503, json={"error": {"message": "high demand"}})
        body = {"candidates": [{"content": {"parts": [{"text": '{"claims": []}'}]}}]}
        return httpx.Response(200, json=body)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            g = Gemini(client, "k", "primary", "emb", 0, "low", ["backup"])
            assert await g.extract_claims("teks", "caption", 5) == []
            # Panggilan kedua langsung ke cadangan: model utama sedang dalam masa jeda.
            assert await g.extract_claims("teks", "caption", 5) == []

    asyncio.run(run())
    assert calls == ["primary", "backup", "backup"]


def test_embedding_cannot_override_different_event():
    # Embedding live menilai "bakti sosial" mirip "serang" (pelaku/tempat/tanggal sama); tetap harus ditolak.
    claim = "TNI menggelar bakti sosial pengobatan gratis di Aceh pada 1 November 2026"
    assert context_match(claim, KOMDIGI, semantic=0.95) < MATCH_MIN
    assert context_match("TNI akan menyerang Aceh pada 1 November 2026", KOMDIGI, semantic=0.95) >= MATCH_MIN


def test_gemini_budget_keeps_reserve_for_high_priority():
    import asyncio

    import httpx
    import pytest

    from app.providers.gemini import BudgetExhausted, Gemini

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": '{"claims": []}'}]}}]})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            g = Gemini(client, "k", "m", "emb", 0, "low", rpm=3)  # cadangan = 1 untuk prioritas tinggi
            await g.extract_claims("a", "caption", 5)
            await g.extract_claims("b", "caption", 5)
            with pytest.raises(BudgetExhausted):
                await g.extract_claims("c", "caption", 5)  # prioritas rendah berhenti sebelum cadangan
            await g.extract_claims("d", "caption", 5, priority="high")  # OCR tetap dapat jatah
            with pytest.raises(BudgetExhausted):
                await g.extract_claims("e", "caption", 5, priority="high")

    asyncio.run(run())


def test_llm_router_uses_next_provider_on_failure():
    import asyncio

    from app.providers.llm import LLMRouter

    class Down:
        name = "down"

        async def extract_claims(self, text, source, timeout, priority="low"):
            raise RuntimeError("kuota habis")

    class Up:
        name = "up"

        async def extract_claims(self, text, source, timeout, priority="low"):
            return [{"text": text, "kind": "factual", "tni_related": False}]

    router = LLMRouter([Down(), Up()], embedder=None)
    assert router.names == ["down", "up"]
    assert asyncio.run(router.extract_claims("klaim", "caption", 5))[0]["text"] == "klaim"


def test_general_news_cannot_refute_only_factcheck_pages_can():
    from app.ratings import is_factcheck_page

    assert is_factcheck_page("https://www.liputan6.com/cek-fakta/read/4359840/cek-fakta-tidak-benar")
    assert is_factcheck_page("https://www.kompas.com/cekfakta/read/2026/10/16/x")
    assert is_factcheck_page("https://ppid.tniad.mil.id/index.php/i/34495/klarifikasi")
    assert not is_factcheck_page("https://www.liputan6.com/health/read/3599684/8-manfaat-daun-sirsak")


def test_same_source_listed_once():
    from app.conclusion import order_evidence

    a, b = ev("c1", 1.0), ev("c2", 1.0)
    assert len(order_evidence([a, b], "c1")) == 1


def test_llm_providers_send_researcher_system_prompt():
    import asyncio
    import json

    import httpx

    from app.providers.gemini import Gemini
    from app.providers.groq import GroqLLM

    sent = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        if "googleapis" in request.url.host:
            text = json.dumps({"claims": []})
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"claims": []})}}]})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await Gemini(client, "k", "gemini-3.8-flash", "e", None).extract_claims("teks", "caption", 5)
            await GroqLLM(client, "k", "m").extract_claims("teks", "caption", 5)

    asyncio.run(run())
    gemini, groq = sent
    assert "Google Fact Check" in gemini["systemInstruction"]["parts"][0]["text"]
    assert groq["messages"][0]["role"] == "system" and "Google Fact Check" in groq["messages"][0]["content"]
    assert "<<<\nteks\n>>>" in groq["messages"][1]["content"]


def test_llm_queries_are_cleaned_and_kept_server_side():
    from app.pipeline import Pipeline

    raw = [{"text": "TNI akan menyerang Aceh pada 1 November 2026", "kind": "factual", "tni_related": True,
            "queries": ["TNI serang Aceh", "tni  serang aceh", "TNI akan menyerang Aceh pada 1 November 2026",
                        "TNI attack Aceh", "hoaks TNI Aceh", "x"]}]
    [claim] = Pipeline._claims_from_llm(raw, "caption")
    assert claim.queries == ["TNI serang Aceh", "TNI attack Aceh", "hoaks TNI Aceh"]
    assert "queries" not in claim.model_dump()  # tidak ikut ke extension, cache, atau laporan


def test_fact_check_searches_llm_queries_and_keeps_stance_reason():
    import asyncio

    from app.cache import MemoryCache
    from app.corpus import Corpus
    from app.evidence import EvidenceFinder
    from app.providers.factcheck import ClaimReview

    class FakeFactCheck:
        def __init__(self):
            self.queries = []

        async def search(self, query, timeout, language=None):
            self.queries.append(query)
            if query != "TNI serang Aceh":
                return []
            return [ClaimReview("TNI akan menyerang Aceh pada 1 November 2026", "Turnbackhoax",
                                "[HOAKS] TNI akan menyerang Aceh", "https://turnbackhoax.id/tni-aceh",
                                "Salah", "2026-10-20")]

    class FakeLLM:
        async def classify_stance(self, claim, items, timeout):
            return [{"index": 0, "same_event": True, "stance": "refutes", "rating": "Hoaks",
                     "reason": "Kodam Iskandar Muda membantah rencana serangan"}]

    factcheck = FakeFactCheck()
    finder = EvidenceFinder(Corpus(False), MemoryCache(), 60, 2, None, factcheck, None)
    claim = Claim(id="c1", text="TNI akan menyerang Aceh pada 1 November 2026", source="caption",
                  tni_related=True, queries=["TNI serang Aceh"])
    evidence = asyncio.run(finder.find(claim))
    assert "TNI serang Aceh" in factcheck.queries
    found = next(e for e in evidence if e.publisher == "Turnbackhoax")  # hanya ditemukan lewat query LLM
    assert found.origin == "factcheck" and found.reason is None

    from app.evidence import Candidate
    finder.gemini = FakeLLM()
    hit = Candidate("", "detik.com", "Kodam bantah serangan ke Aceh", "https://x", "", None, 0.8, "search", "...")
    asyncio.run(finder._resolve_stance(claim.text, [(hit, 0.8)]))
    assert hit.rating == "Hoaks" and hit.reason == "Kodam Iskandar Muda membantah rencana serangan"
