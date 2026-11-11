"""Google Fact Check Tools API (claims:search)."""

from dataclasses import dataclass

import httpx


@dataclass
class ClaimReview:
    claim_reviewed: str
    publisher: str
    title: str
    url: str
    rating: str
    date: str | None


class FactCheckAPI:
    URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    def __init__(self, client: httpx.AsyncClient, api_key: str):
        self._client = client
        self._key = api_key

    async def search(self, query: str, timeout: float, language: str | None = None) -> list[ClaimReview]:
        params: dict[str, str | int] = {"query": query[:200], "pageSize": 10}
        if language:
            params["languageCode"] = language
        # Kunci di header, bukan query string, agar tidak tercatat di log akses atau log httpx.
        resp = await self._client.get(self.URL, params=params, headers={"x-goog-api-key": self._key}, timeout=timeout)
        resp.raise_for_status()
        out: list[ClaimReview] = []
        for claim in resp.json().get("claims", []):
            for review in claim.get("claimReview", []):
                if not review.get("url"):
                    continue
                publisher = review.get("publisher", {})
                out.append(ClaimReview(
                    claim_reviewed=claim.get("text", ""),
                    publisher=publisher.get("name") or publisher.get("site") or "Pemeriksa fakta",
                    title=review.get("title") or claim.get("text", ""),
                    url=review["url"],
                    rating=review.get("textualRating", ""),
                    date=(review.get("reviewDate") or claim.get("claimDate") or "")[:10] or None,
                ))
        return out
