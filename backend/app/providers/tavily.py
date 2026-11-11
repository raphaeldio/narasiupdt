"""Tavily Search, dibatasi ke whitelist situs terpercaya."""

from dataclasses import dataclass

import httpx


@dataclass
class SearchHit:
    title: str
    url: str
    content: str
    date: str | None


class TavilySearch:
    URL = "https://api.tavily.com/search"

    def __init__(self, client: httpx.AsyncClient, api_key: str, domains: list[str]):
        self._client = client
        self._key = api_key
        self._domains = domains

    async def search(self, query: str, timeout: float) -> list[SearchHit]:
        resp = await self._client.post(
            self.URL,
            headers={"Authorization": f"Bearer {self._key}"},
            json={
                "query": f"cek fakta {query[:300]}",
                "search_depth": "basic",
                "max_results": 5,
                "include_domains": self._domains,
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        return [
            SearchHit(r.get("title", ""), r["url"], r.get("content", ""), (r.get("published_date") or "")[:10] or None)
            for r in resp.json().get("results", [])
            if r.get("url")
        ]
