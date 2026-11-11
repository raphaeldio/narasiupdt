"""Gemini: ekstraksi klaim, OCR frame, klasifikasi sikap bukti, kesimpulan, dan embedding."""

import base64
import json
import logging
import math
import time
from collections import deque
from typing import Any, Literal

import httpx

from .prompts import (CLAIM_SCHEMA_HINT, SYSTEM_PROMPT, assess_prompt, claims_prompt, conclusion_prompt, ocr_prompt,
                      stance_prompt)

log = logging.getLogger("narasi.gemini")

BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Diekspor ulang untuk kompatibilitas impor lama.
__all__ = ["CLAIM_SCHEMA_HINT", "Gemini", "BudgetExhausted"]


RETRYABLE = {429, 500, 503, 504}
COOLDOWN_SECONDS = 60.0
Priority = Literal["high", "low"]


class BudgetExhausted(Exception):
    """Kuota per menit menipis; pemanggil langsung memakai jalur heuristik tanpa menunggu 429."""


class Gemini:
    name = "gemini"
    # Embedding Gemini memberi cosine ±0,55 untuk teks tak terkait; lihat rescale_cosine.
    cosine_floor = 0.55
    cosine_span = 0.35

    def __init__(self, client: httpx.AsyncClient, api_key: str, model: str, embed_model: str,
                 thinking_budget: int | None, thinking_level: str | None = None,
                 fallback_models: list[str] | None = None, rpm: int = 0):
        self._client = client
        self._key = api_key
        self._models = [model, *(m for m in fallback_models or [] if m != model)]
        self._embed_model = embed_model
        self._thinking_budget = thinking_budget
        self._thinking_level = thinking_level
        # Model yang baru menolak (kelebihan beban) dilewati sementara agar tidak membuang anggaran waktu.
        self._cooldown_until: dict[str, float] = {}
        # Anggaran permintaan per menit (0 = tanpa batas). Panggilan prioritas rendah menyisakan
        # cadangan untuk panggilan yang tidak punya pengganti heuristik (OCR).
        self._rpm = rpm
        self._reserve = max(1, rpm // 3)
        self._sent: deque[float] = deque()

    def _acquire(self, priority: Priority) -> None:
        if not self._rpm:
            return
        now = time.monotonic()
        while self._sent and self._sent[0] < now - 60:
            self._sent.popleft()
        limit = self._rpm if priority == "high" else self._rpm - self._reserve
        if len(self._sent) >= limit:
            raise BudgetExhausted(f"anggaran {self._rpm}/menit terpakai ({priority})")
        self._sent.append(now)

    def _thinking_config(self, model: str) -> dict[str, Any] | None:
        # Seri 2.5 memakai thinkingBudget; seri 3 ke atas memakai thinkingLevel. Keduanya tidak boleh digabung.
        if "2.5" in model:
            return None if self._thinking_budget is None else {"thinkingBudget": self._thinking_budget}
        return {"thinkingLevel": self._thinking_level} if self._thinking_level else None

    def _candidates(self) -> list[str]:
        now = time.monotonic()
        ready = [m for m in self._models if self._cooldown_until.get(m, 0) <= now]
        # Bila semua sedang jeda, tetap coba model yang jedanya paling cepat berakhir.
        return ready or sorted(self._models, key=lambda m: self._cooldown_until.get(m, 0))[:1]

    async def _generate(self, parts: list[dict[str, Any]], timeout: float,
                        priority: Priority = "low") -> dict[str, Any]:
        self._acquire(priority)
        deadline = time.monotonic() + timeout
        last_error: Exception | None = None
        for model in self._candidates():
            remaining = deadline - time.monotonic()
            if remaining <= 0.2:
                break
            try:
                return await self._generate_with(model, parts, remaining)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in RETRYABLE:
                    raise
                last_error = exc
                self._cooldown_until[model] = time.monotonic() + _cooldown_for(exc.response)
            except httpx.TimeoutException as exc:
                last_error = exc
                self._cooldown_until[model] = time.monotonic() + COOLDOWN_SECONDS
            log.warning("model %s tidak tersedia, mencoba cadangan: %s", model, last_error)
        raise last_error or TimeoutError("anggaran waktu Gemini habis")

    async def _generate_with(self, model: str, parts: list[dict[str, Any]], timeout: float) -> dict[str, Any]:
        config: dict[str, Any] = {"responseMimeType": "application/json", "temperature": 0.1}
        if thinking := self._thinking_config(model):
            config["thinkingConfig"] = thinking
        resp = await self._client.post(
            f"{BASE}/{model}:generateContent",
            headers={"x-goog-api-key": self._key},
            json={"systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                  "contents": [{"role": "user", "parts": parts}], "generationConfig": config},
            timeout=timeout,
        )
        resp.raise_for_status()
        out_parts = resp.json()["candidates"][0]["content"]["parts"]
        text = next(p["text"] for p in out_parts if "text" in p and not p.get("thought"))
        return json.loads(text)

    async def extract_claims(self, text: str, source: str, timeout: float,
                             priority: Priority = "low") -> list[dict[str, Any]]:
        data = await self._generate([{"text": claims_prompt(text, source)}], timeout, priority)
        return list(data.get("claims", []))

    async def ocr_and_claims(self, frames: list[tuple[str, bytes]], caption: str, timeout: float) -> dict[str, Any]:
        parts: list[dict[str, Any]] = [{"text": ocr_prompt(caption)}]
        for mime, data in frames:
            parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}})
        # OCR tidak punya pengganti heuristik, jadi memakai kuota prioritas tinggi.
        return await self._generate(parts, timeout, "high")

    async def classify_stance(self, claim: str, items: list[dict[str, str]], timeout: float) -> list[dict[str, Any]]:
        data = await self._generate([{"text": stance_prompt(claim, items)}], timeout)
        return list(data.get("items", []))

    async def conclusion(self, claims: list[str], evidence: list[dict[str, str]], label: str,
                         score: int | None, timeout: float) -> str:
        data = await self._generate([{"text": conclusion_prompt(claims, evidence, label, score)}], timeout)
        return str(data.get("conclusion", "")).strip()

    async def assess(self, claims: list[str], timeout: float) -> dict[str, Any]:
        return await self._generate([{"text": assess_prompt(claims)}], timeout)

    async def embed(self, texts: list[str], timeout: float) -> list[list[float]]:
        model = f"models/{self._embed_model}"
        resp = await self._client.post(
            f"{BASE}/{self._embed_model}:batchEmbedContents",
            headers={"x-goog-api-key": self._key},
            json={"requests": [{"model": model, "content": {"parts": [{"text": t}]}} for t in texts]},
            timeout=timeout,
        )
        resp.raise_for_status()
        return [e["values"] for e in resp.json()["embeddings"]]


def _cooldown_for(resp: httpx.Response) -> float:
    """Jeda model setelah 429/503: sampai kuota harian reset bila itu penyebabnya, 60 detik bila tidak."""
    try:
        details = resp.json().get("error", {}).get("details", [])
    except ValueError:
        return COOLDOWN_SECONDS
    daily = any("PerDay" in str(v.get("quotaId", "")) for d in details for v in d.get("violations", []))
    if not daily:
        return COOLDOWN_SECONDS
    delay = next((d.get("retryDelay") for d in details if d.get("retryDelay")), "3600s")
    try:
        return max(COOLDOWN_SECONDS, float(str(delay).rstrip("s")))
    except ValueError:
        return 3600.0


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def rescale_cosine(c: float, floor: float = 0.55, span: float = 0.35) -> float:
    """Geser cosine agar 0 = tak terkait. Embedding Gemini memberi ±0,55 untuk teks tak terkait."""
    return max(0.0, min(1.0, (c - floor) / span))
