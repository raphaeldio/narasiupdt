"""Pencarian berita lewat RSS Google News: gratis, tanpa kunci API, dan tersedia per bahasa/negara.

Hanya hasil dari media terverifikasi dan pemeriksa fakta (ratings.is_trusted) yang dipakai.
Tautan artikel berupa pengalih news.google.com; domain penerbit diambil dari elemen <source url>.
"""

import email.utils
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx

from ..lang import NEWS_EDITIONS
from ..ratings import is_trusted

MAX_BYTES = 2_000_000


@dataclass
class NewsHit:
    title: str
    url: str
    publisher: str
    source_url: str
    date: str | None


def _date(value: str | None) -> str | None:
    try:
        return email.utils.parsedate_to_datetime(value).date().isoformat() if value else None
    except (TypeError, ValueError):
        return None


def parse_news(xml_text: str, limit: int = 8) -> list[NewsHit]:
    root = ET.fromstring(xml_text)
    hits: list[NewsHit] = []
    for item in root.iter("item"):
        source = item.find("source")
        source_url = source.get("url", "") if source is not None else ""
        link = (item.findtext("link") or "").strip()
        title = (item.findtext("title") or "").strip()
        publisher = (source.text or "").strip() if source is not None else ""
        if not link or not title or not is_trusted(source_url):
            continue
        # Google News menulis judul sebagai "Judul - Nama Media".
        if publisher and title.endswith(f" - {publisher}"):
            title = title[: -len(publisher) - 3].strip()
        hits.append(NewsHit(title, link, publisher or source_url, source_url, _date(item.findtext("pubDate"))))
        if len(hits) >= limit:
            break
    return hits


class NewsSearch:
    URL = "https://news.google.com/rss/search"

    def __init__(self, client: httpx.AsyncClient):
        self._client = client

    async def search(self, query: str, timeout: float, language: str = "id") -> list[NewsHit]:
        hl, gl, ceid = NEWS_EDITIONS.get(language, NEWS_EDITIONS["en"])
        resp = await self._client.get(
            self.URL, params={"q": query[:200], "hl": hl, "gl": gl, "ceid": ceid},
            headers={"User-Agent": "Mozilla/5.0 (compatible; factcheck-research/1.0)"},
            timeout=timeout, follow_redirects=True,
        )
        resp.raise_for_status()
        if len(resp.content) > MAX_BYTES:
            return []
        return parse_news(resp.text)
