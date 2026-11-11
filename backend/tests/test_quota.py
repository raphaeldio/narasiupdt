"""Hemat kuota: banyak penonton serentak tidak boleh melipatgandakan permintaan ke LLM/API berbayar."""

import asyncio

import pytest

from app.cache import MemoryCache
from app.corpus import Corpus
from app.evidence import EvidenceFinder
from app.models import Claim
from app.providers.gemini import BudgetExhausted
from app.providers.llm import Budget, LLMRouter
from app.usage import usage


class CountingLLM:
    name = "fake"

    def __init__(self, delay: float = 0.05):
        self.calls = 0
        self.delay = delay

    async def extract_claims(self, text, source, timeout, priority="low"):
        self.calls += 1
        await asyncio.sleep(self.delay)
        return [{"text": text, "kind": "factual", "tni_related": True}]

    async def ocr_and_claims(self, frames, caption, timeout):
        self.calls += 1
        await asyncio.sleep(self.delay)
        return {"ocr_text": "TNI", "claims": []}


@pytest.fixture(autouse=True)
def fresh_usage():
    usage.reset()


def test_concurrent_identical_calls_share_one_request():
    llm = CountingLLM()
    router = LLMRouter([llm], None, MemoryCache())

    async def main():
        # 100 penonton membuka video yang sama bersamaan.
        await asyncio.gather(*(router.extract_claims("TNI akan serang Aceh besok", "caption", 5) for _ in range(100)))
        # Penonton berikutnya: dari cache, tanpa permintaan baru.
        await router.extract_claims("TNI akan serang Aceh besok", "caption", 5)

    asyncio.run(main())
    assert llm.calls == 1
    snap = usage.snapshot()
    assert snap["llm_calls"] == 1 and snap["llm_saved"] == 100


def test_ocr_once_per_video_even_with_different_frames():
    llm = CountingLLM()
    router = LLMRouter([llm], None, MemoryCache())

    async def main():
        await asyncio.gather(*(router.ocr_and_claims([("image/jpeg", bytes([i]))], "cap", 5, key="tiktok:v1")
                               for i in range(20)))

    asyncio.run(main())
    assert llm.calls == 1


def test_caller_timeout_does_not_waste_the_request():
    llm = CountingLLM(delay=0.3)
    cache = MemoryCache()
    router = LLMRouter([llm], None, cache)

    async def main():
        with pytest.raises(TimeoutError):
            await asyncio.wait_for(router.extract_claims("klaim panjang soal TNI", "caption", 5), 0.05)
        await asyncio.sleep(0.4)
        # Hasil panggilan yang ditinggal tetap tersimpan untuk penonton berikutnya.
        return await router.extract_claims("klaim panjang soal TNI", "caption", 5)

    assert asyncio.run(main())[0]["text"] == "klaim panjang soal TNI"
    assert llm.calls == 1


def test_budget_blocks_requests_and_reserves_for_ocr():
    llm = CountingLLM(delay=0)
    router = LLMRouter([llm], None, MemoryCache(), budget=Budget(per_minute=5))

    async def main():
        for i in range(4):  # 5 - cadangan 1 untuk OCR
            await router.extract_claims(f"klaim nomor {i} tentang TNI", "caption", 5)
        with pytest.raises(BudgetExhausted):
            await router.extract_claims("klaim kelima tentang TNI", "caption", 5)
        await router.ocr_and_claims([("image/jpeg", b"x")], "cap", 5, key="v")  # prioritas tinggi masih boleh

    asyncio.run(main())
    assert llm.calls == 5
    assert usage.snapshot()["skipped_by_budget"] == {"llm.claims": 1}


def test_daily_budget():
    budget = Budget(per_day=2)
    budget.acquire()
    budget.acquire()
    with pytest.raises(BudgetExhausted):
        budget.acquire("high")


def test_evidence_search_shared_between_concurrent_viewers():
    class SlowFactCheck:
        calls = 0

        async def search(self, query, timeout, language=None):
            SlowFactCheck.calls += 1
            await asyncio.sleep(0.05)
            return []

    finder = EvidenceFinder(Corpus(False), MemoryCache(), 60, 2, None, SlowFactCheck(), None)
    claim = Claim(id="c9", text="TNI akan menyerang Aceh pada 1 November 2026", source="caption")

    async def main():
        await asyncio.gather(*(finder.find(claim) for _ in range(50)))
        await finder.find(claim)

    asyncio.run(main())
    assert SlowFactCheck.calls == 2  # satu pencarian (bahasa id + semua bahasa), bukan 102


def test_production_rejects_unsafe_config():
    from app.config import Settings
    from app.main import check_production

    with pytest.raises(RuntimeError, match="DASHBOARD_TOKEN"):
        check_production(Settings(_env_file=None, environment="production"))
    check_production(Settings(_env_file=None, environment="production", dashboard_token="x" * 32,
                              testbed_fixtures=False, viewer_salt="garam-tetap"))
