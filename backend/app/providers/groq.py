"""Groq: Whisper untuk transkripsi audio, dan LLM (teks + vision) untuk klaim, OCR, sikap bukti, kesimpulan."""

import base64
import json
from typing import Any

import httpx

from .prompts import SYSTEM_PROMPT, assess_prompt, claims_prompt, conclusion_prompt, ocr_prompt, stance_prompt


class GroqASR:
    URL = "https://api.groq.com/openai/v1/audio/transcriptions"

    def __init__(self, client: httpx.AsyncClient, api_key: str, model: str):
        self._client = client
        self._key = api_key
        self._model = model

    async def transcribe(self, audio: bytes, mime: str, timeout: float) -> str:
        ext = "webm" if "webm" in mime else "ogg" if "ogg" in mime else "mp4" if "mp4" in mime else "wav"
        resp = await self._client.post(
            self.URL,
            headers={"Authorization": f"Bearer {self._key}"},
            files={"file": (f"chunk.{ext}", audio, mime)},
            # Tanpa "language": Whisper mendeteksi sendiri, jadi video berbahasa asing ikut tertranskripsi.
            data={"model": self._model, "response_format": "json", "temperature": "0"},
            timeout=timeout,
        )
        resp.raise_for_status()
        return str(resp.json().get("text", "")).strip()


class GroqLLM:
    """API kompatibel OpenAI dengan mode JSON. Model default (qwen3.8-27b) juga menerima gambar."""

    URL = "https://api.groq.com/openai/v1/chat/completions"
    name = "groq"

    def __init__(self, client: httpx.AsyncClient, api_key: str, model: str):
        self._client = client
        self._key = api_key
        self._model = model

    async def _chat(self, content: str | list[dict[str, Any]], timeout: float) -> dict[str, Any]:
        resp = await self._client.post(
            self.URL,
            headers={"Authorization": f"Bearer {self._key}"},
            json={
                "model": self._model,
                "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": content}],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        return json.loads(resp.json()["choices"][0]["message"]["content"])

    async def extract_claims(self, text: str, source: str, timeout: float, priority: str = "low") -> list[dict[str, Any]]:
        return list((await self._chat(claims_prompt(text, source), timeout)).get("claims", []))

    async def ocr_and_claims(self, frames: list[tuple[str, bytes]], caption: str, timeout: float) -> dict[str, Any]:
        content: list[dict[str, Any]] = [{"type": "text", "text": ocr_prompt(caption)}]
        for mime, data in frames:
            url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
            content.append({"type": "image_url", "image_url": {"url": url}})
        return await self._chat(content, timeout)

    async def classify_stance(self, claim: str, items: list[dict[str, str]], timeout: float) -> list[dict[str, Any]]:
        return list((await self._chat(stance_prompt(claim, items), timeout)).get("items", []))

    async def assess(self, claims: list[str], timeout: float) -> dict[str, Any]:
        return await self._chat(assess_prompt(claims), timeout)

    async def conclusion(self, claims: list[str], evidence: list[dict[str, str]], label: str,
                         score: int | None, timeout: float) -> str:
        data = await self._chat(conclusion_prompt(claims, evidence, label, score), timeout)
        return str(data.get("conclusion", "")).strip()
