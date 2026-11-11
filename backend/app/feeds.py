"""Indeks artikel pemeriksa fakta dari RSS/Atom: pendekatan lain selain Google Fact Check.

Feed TurnBackHoax (Mafindo), Snopes, PolitiFact, Full Fact, dan Lead Stories diambil berkala lalu
disimpan di berkas lokal. Pencarian klaim berjalan di memori, jadi tidak memakai kuota apa pun, tetap
jalan saat API eksternal lambat, dan indeksnya terus bertambah selama server hidup.
"""

import asyncio
import email.utils
import html
import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx

from .text import dice, tokens, trigrams

log = logging.getLogger("narasi.feeds")

MAX_ENTRIES = 6000
MAX_BYTES = 3_000_000
CANDIDATE_MIN = 0.3
ATOM = "{http://www.w3.org/2005/Atom}"

# (penerbit, URL feed, bahasa)
SOURCES: tuple[tuple[str, str, str], ...] = (
    ("TurnBackHoax (Mafindo)", "https://turnbackhoax.id/feed/", "id"),
    ("Snopes", "https://www.snopes.com/feed/", "en"),
    ("PolitiFact", "https://www.politifact.com/rss/factchecks/", "en"),
    ("Full Fact", "https://fullfact.org/feed/", "en"),
    ("Lead Stories", "https://leadstories.com/atom.xml", "en"),
)

_TAG = re.compile(r"<[^>]+>")
_BRACKET = re.compile(r"^\s*\[([^\]]{2,30})\]\s*")
_PREFIX = re.compile(r"^\s*(fact check|cek fakta|hoax alert)\s*[:\-–]\s*", re.I)
_BRACKET_RATING = {
    "salah": "Salah", "hoaks": "Hoaks", "hoax": "Hoaks", "penipuan": "Penipuan", "disinformasi": "Disinformasi",
    "fitnah": "Fitnah", "misinformasi": "Misinformasi", "menyesatkan": "Menyesatkan", "benar": "Benar",
    "klarifikasi": "Klarifikasi", "satire": "Satire", "parodi": "Satire",
}
# Judul artikel cek fakta berbahasa Inggris yang secara eksplisit membantah.
_EN_FALSE = re.compile(
    r"\b(did not|does not|do not|is not|are not|was not|were not|has not|have not|no evidence|not real|"
    r"isn't|aren't|wasn't|weren't|doesn't|didn't|don't|fake|hoax|false|fabricated|ai-generated|ai generated|"
    r"altered|doctored|debunked|wrong|baseless|misattributed|scam|not true|never said|never happened)\b", re.I)
_EN_MIXED = re.compile(r"\b(misleading|missing context|lacks context|out of context|exaggerat\w+|partly)\b", re.I)


@dataclass
class FeedEntry:
    claim: str
    title: str
    url: str
    publisher: str
    rating: str  # kosong = sikap belum diketahui (dinilai LLM saat dipakai)
    date: str | None
    language: str
    summary: str = ""


def rating_and_claim(title: str, language: str) -> tuple[str, str]:
    """Rating dari konvensi judul pemeriksa fakta, dan judul tanpa label sebagai klaim yang diperiksa."""
    rating = ""
    claim = title
    if m := _BRACKET.match(title):
        rating = _BRACKET_RATING.get(m.group(1).strip().lower(), "")
        claim = title[m.end():]
    claim = _PREFIX.sub("", claim).strip()
    if not rating and language == "en":
        # "NOT" huruf besar adalah gaya Lead Stories; frasa lain dipakai Full Fact dan PolitiFact.
        if _EN_MIXED.search(title):
            rating = "Misleading"
        elif " NOT " in title or _EN_FALSE.search(title):
            rating = "False"
    return rating, claim


def _clean(value: str | None, limit: int = 400) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", html.unescape(value or "")))).strip()[:limit]


def _date(value: str | None) -> str | None:
    if not value:
        return None
    if re.match(r"\d{4}-\d{2}-\d{2}", value):
        return value[:10]
    try:
        return email.utils.parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError):
        return None


_ITEM = re.compile(r"<item\b.*?</item>", re.S)


def _field(block: str, tag: str) -> str:
    m = re.search(rf"<{tag}\b[^>]*>(.*?)</{tag}>", block, re.S)
    value = m.group(1) if m else ""
    return re.sub(r"^\s*<!\[CDATA\[(.*?)\]\]>\s*$", r"\1", value, flags=re.S)


def _parse_loose(xml_text: str, publisher: str, language: str) -> list[FeedEntry]:
    """Feed yang XML-nya tidak valid (mis. prefix namespace tidak dideklarasikan) dibaca dengan regex."""
    entries = []
    for block in _ITEM.findall(xml_text):
        title, url = _clean(_field(block, "title"), 300), _field(block, "link").strip()
        if not title or not url.startswith("http"):
            continue
        summary = _clean(_field(block, "description"))
        rating, claim = rating_and_claim(title, language)
        if publisher == "PolitiFact" and summary:
            claim = summary[:300]
        entries.append(FeedEntry(claim, title, url, publisher, rating, _date(_field(block, "pubDate").strip()),
                                 language, summary))
    return entries


def parse_feed(xml_text: str, publisher: str, language: str) -> list[FeedEntry]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return _parse_loose(xml_text, publisher, language)
    entries: list[FeedEntry] = []
    for item in [*root.iter("item"), *root.iter(f"{ATOM}entry")]:
        atom = item.tag.startswith(ATOM)
        if atom:
            title = _clean(item.findtext(f"{ATOM}title"), 300)
            link_el = next((link for link in item.findall(f"{ATOM}link") if link.get("rel", "alternate") == "alternate"), None)
            url = link_el.get("href", "") if link_el is not None else ""
            summary = _clean(item.findtext(f"{ATOM}summary"))
            date = _date(item.findtext(f"{ATOM}published") or item.findtext(f"{ATOM}updated"))
        else:
            title = _clean(item.findtext("title"), 300)
            url = (item.findtext("link") or "").strip()
            summary = _clean(item.findtext("description"))
            date = _date(item.findtext("pubDate"))
        if not title or not url.startswith("http"):
            continue
        rating, claim = rating_and_claim(title, language)
        # PolitiFact menaruh pernyataan yang diperiksa di deskripsi ("Says …").
        if publisher == "PolitiFact" and summary:
            claim = summary[:300]
        entries.append(FeedEntry(claim, title, url, publisher, rating, date, language, summary))
    return entries


class FactFeedIndex:
    def __init__(self, client: httpx.AsyncClient | None, path: str | None,
                 sources: tuple[tuple[str, str, str], ...] = SOURCES):
        self._client = client
        self._path = Path(path) if path else None
        self._sources = sources
        self.entries: dict[str, FeedEntry] = {}
        # Token dan trigram tiap artikel dihitung sekali; indeks terbalik memangkas kandidat per pencarian.
        self._features: dict[str, tuple[frozenset[str], frozenset[str]]] = {}
        self._by_token: dict[str, set[str]] = {}
        self.refreshed_at: float | None = None
        self.status: dict[str, int | str] = {}
        self._load()

    def __len__(self) -> int:
        return len(self.entries)

    def _load(self) -> None:
        if not self._path or not self._path.exists():
            return
        try:
            for raw in json.loads(self._path.read_text(encoding="utf-8")):
                self.add([FeedEntry(**raw)])
        except (ValueError, TypeError, OSError) as exc:
            log.warning("indeks feed lokal tidak terbaca, mulai dari kosong: %s", exc)

    def _save(self) -> None:
        if not self._path:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps([asdict(e) for e in self.entries.values()], ensure_ascii=False),
                              encoding="utf-8")

    def add(self, entries: list[FeedEntry]) -> int:
        new = 0
        for e in entries:
            if e.url in self.entries:
                continue
            new += 1
            self.entries[e.url] = e
            text = f"{e.claim} {e.title}" if e.claim != e.title else e.title
            toks = frozenset(tokens(text))
            self._features[e.url] = (toks, frozenset(trigrams(e.claim)))
            for t in toks:
                self._by_token.setdefault(t, set()).add(e.url)
        if len(self.entries) > MAX_ENTRIES:
            # dict menjaga urutan sisip: yang terlama dibuang lebih dulu.
            for url in list(self.entries)[: len(self.entries) - MAX_ENTRIES]:
                del self.entries[url]
                for t in self._features.pop(url)[0]:
                    self._by_token[t].discard(url)
        return new

    async def _fetch(self, publisher: str, url: str, language: str) -> int:
        assert self._client
        try:
            resp = await self._client.get(
                url, timeout=15, follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; factcheck-research/1.0)"})
            resp.raise_for_status()
            if len(resp.content) > MAX_BYTES:
                raise ValueError("feed terlalu besar")
            added = self.add(parse_feed(resp.text, publisher, language))
            self.status[publisher] = added
            return added
        except Exception as exc:  # satu feed gagal tidak menghentikan yang lain
            self.status[publisher] = f"gagal: {type(exc).__name__}"
            log.warning("feed %s gagal: %r", publisher, exc)
            return 0

    async def refresh(self) -> int:
        if not self._client:
            return 0
        added = sum(await asyncio.gather(*(self._fetch(*s) for s in self._sources)))
        self.refreshed_at = time.time()
        if added:
            await asyncio.to_thread(self._save)
        log.info("indeks feed: +%d artikel baru, total %d", added, len(self.entries))
        return added

    async def run(self, every: float) -> None:
        while True:
            await self.refresh()
            await asyncio.sleep(every)

    def search(self, text: str, limit: int = 5) -> list[FeedEntry]:
        q_tokens, q_tri = set(tokens(text)), trigrams(text)
        shared: dict[str, int] = {}
        for t in q_tokens:
            for url in self._by_token.get(t, ()):
                shared[url] = shared.get(url, 0) + 1
        need = 2 if len(q_tokens) >= 3 else 1
        scored = []
        for url, n in shared.items():
            if n < need:
                continue
            toks, tri = self._features[url]
            s = 0.6 * dice(q_tokens, set(toks)) + 0.4 * dice(q_tri, set(tri))
            if s >= CANDIDATE_MIN:
                scored.append((s, self.entries[url]))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:limit]]

    def snapshot(self) -> dict:
        return {"entries": len(self.entries), "refreshed_at": self.refreshed_at, "sources": dict(self.status)}
