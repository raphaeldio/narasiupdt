"""Router LLM: coba penyedia berurutan (mis. Groq lalu Gemini) dengan antarmuka yang sama.

Penyedia yang gagal (kuota, 5xx, batas waktu, JSON rusak) dilewati dan penyedia berikutnya
dicoba dalam sisa anggaran waktu yang sama. Embedding selalu memakai Gemini (kuota terpisah).

Hemat kuota untuk banyak pengguna di satu satuan:
- hasil disimpan di cache kolektif (Redis) berdasarkan isi masukan, jadi caption/klaim yang sama
  (video yang diunggah ulang, penonton berikutnya) tidak pernah dikirim dua kali;
- permintaan serentak dengan masukan sama digabung menjadi satu panggilan (singleflight);
- pagar kuota per menit dan per hari untuk seluruh server; bila habis, pemanggil memakai heuristik.
"""

import hashlib
import json
import logging
import time
from collections import deque
from datetime import date
from typing import Any

from ..cache import Cache, MemoryCache, SingleFlight, memo
from ..usage import usage
from .gemini import BudgetExhausted, rescale_cosine

log = logging.getLogger("narasi.llm")

# Naikkan bila format prompt/keluaran berubah agar hasil lama di cache tidak dipakai.
CACHE_VERSION = "v2"


class Budget:
    """Batas permintaan LLM untuk seluruh server. Prioritas rendah menyisakan cadangan untuk OCR."""

    def __init__(self, per_minute: int = 0, per_day: int = 0):
        self.per_minute = per_minute
        self.per_day = per_day
        self._minute: deque[float] = deque()
        self._day = date.today()
        self._day_count = 0

    def acquire(self, priority: str = "low") -> None:
        now = time.monotonic()
        while self._minute and self._minute[0] < now - 60:
            self._minute.popleft()
        if self._day != date.today():
            self._day, self._day_count = date.today(), 0
        reserve = max(1, self.per_minute // 5) if priority == "low" and self.per_minute else 0
        if self.per_minute and len(self._minute) >= self.per_minute - reserve:
            raise BudgetExhausted(f"batas {self.per_minute} permintaan LLM/menit tercapai")
        if self.per_day and self._day_count >= self.per_day:
            raise BudgetExhausted(f"batas {self.per_day} permintaan LLM/hari tercapai")
        self._minute.append(now)
        self._day_count += 1

    def snapshot(self) -> dict:
        now = time.monotonic()
        return {"per_minute": self.per_minute, "per_day": self.per_day,
                "used_last_minute": sum(t >= now - 60 for t in self._minute), "used_today": self._day_count}


def _key(method: str, payload: Any) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:32]
    return f"llm:{CACHE_VERSION}:{method}:{digest}"


class LLMRouter:
    def __init__(self, providers: list[Any], embedder: Any | None, cache: Cache | None = None,
                 ttl: int = 30 * 24 * 3600, budget: Budget | None = None):
        self.providers = providers
        self._embedder = embedder
        self._cache = cache or MemoryCache()
        self._ttl = ttl
        self.budget = budget or Budget()
        self._flight = SingleFlight()

    @property
    def names(self) -> list[str]:
        return [getattr(p, "name", type(p).__name__.lower()) for p in self.providers]

    async def _first(self, method: str, timeout: float, *args: Any, _priority: str = "low", **kwargs: Any) -> Any:
        deadline = time.monotonic() + timeout
        last: Exception | None = None
        for provider in self.providers:
            remaining = deadline - time.monotonic()
            if remaining <= 0.2:
                break
            self.budget.acquire(_priority)  # dihitung per permintaan yang benar-benar dikirim
            try:
                return await getattr(provider, method)(*args, timeout=remaining, **kwargs)
            except BudgetExhausted as exc:  # pagar kuota penyedia itu sendiri (mis. Gemini RPM)
                last = exc
            except Exception as exc:  # kuota, galat jaringan, keluaran bukan JSON: coba penyedia berikutnya
                last = exc
                log.warning("%s.%s gagal, mencoba penyedia berikutnya: %r", type(provider).__name__, method, exc)
        raise last or TimeoutError(f"anggaran waktu {method} habis")

    async def _memo(self, method: str, key: str, call) -> Any:
        try:
            value, source = await memo(self._cache, self._flight, key, self._ttl, call)
        except BudgetExhausted:
            usage.record(f"llm.{method}", "budget")
            raise
        usage.record(f"llm.{method}", source)
        return value

    async def extract_claims(self, text: str, source: str, timeout: float, priority: str = "low") -> list[dict[str, Any]]:
        return await self._memo("claims", _key("claims", [text, source]),
                                lambda: self._first("extract_claims", timeout, text, source, _priority=priority, priority=priority))

    async def ocr_and_claims(self, frames: list[tuple[str, bytes]], caption: str, timeout: float,
                             key: str | None = None) -> dict[str, Any]:
        # Frame tiap penonton sedikit berbeda, jadi pemanggil boleh memberi kunci per video: satu OCR per video.
        payload = key or [hashlib.sha256(data).hexdigest() for _, data in frames]
        return await self._memo("ocr", _key("ocr", [payload, caption]),
                                lambda: self._first("ocr_and_claims", timeout, frames, caption, _priority="high"))

    async def classify_stance(self, claim: str, items: list[dict[str, str]], timeout: float) -> list[dict[str, Any]]:
        return await self._memo("stance", _key("stance", [claim, items]),
                                lambda: self._first("classify_stance", timeout, claim, items))

    async def conclusion(self, claims: list[str], evidence: list[dict[str, str]], label: str,
                         score: int | None, timeout: float) -> str:
        return await self._memo("conclusion", _key("conclusion", [claims, evidence, label, score]),
                                lambda: self._first("conclusion", timeout, claims, evidence, label, score))

    async def assess(self, claims: list[str], timeout: float) -> dict[str, Any]:
        """Penilaian awal berbasis pengetahuan model untuk klaim tanpa rujukan; satu panggilan per kumpulan klaim."""
        return await self._memo("assess", _key("assess", sorted(claims)),
                                lambda: self._first("assess", timeout, claims))

    async def embed(self, texts: list[str], timeout: float) -> list[list[float]]:
        if not self._embedder:
            raise RuntimeError("embedding membutuhkan GEMINI_API_KEY")
        usage.record("embed", "call")
        return await self._embedder.embed(texts, timeout)

    def rescale(self, cosine: float) -> float:
        floor = getattr(self._embedder, "cosine_floor", 0.55)
        span = getattr(self._embedder, "cosine_span", 0.35)
        return rescale_cosine(cosine, floor, span)
